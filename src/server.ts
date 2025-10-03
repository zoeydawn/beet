import Fastify from 'fastify'
import view from '@fastify/view'
import handlebars from 'handlebars'
import path from 'path'
import fs from 'fs'
import fastifyStatic from '@fastify/static'
import formBody from '@fastify/formbody'
import session from '@fastify/session'
import cookie from '@fastify/cookie'
// import rateLimit from '@fastify/rate-limit'
import { marked } from 'marked'

import dotenv from 'dotenv'
dotenv.config()

const isProduction = process.env.NODE_ENV === 'production'
const HF_TOKEN = process.env.HUGGING_FACE_API_KEY

import redisPlugin from './plugins/redis.ts'

const ollamaUrl = 'http://localhost:11434'

const app = Fastify({ logger: true })

// --- Register Plugins ---
app.register(redisPlugin)
// so that we can read request bodies
app.register(formBody)

// Serve static files from the "public" folder at the root URL
app.register(fastifyStatic, {
  root: path.join(process.cwd(), 'public'),
  prefix: '/static/', // all files will be served under /static/*
})

// Register handlebars as the template engine
app.register(view, {
  engine: { handlebars },
  root: path.join(process.cwd(), 'views'),
})

// --- Register partials manually ---
const partialsDir = path.join(process.cwd(), 'views/partials')
fs.readdirSync(partialsDir).forEach((file) => {
  const matches = /^([^.]+).hbs$/.exec(file)
  if (!matches) return

  const name = matches[1] // partial name = filename (without .hbs)
  const template = fs.readFileSync(path.join(partialsDir, file), 'utf8')
  handlebars.registerPartial(name, template)
})

// Cookie + session
app.register(cookie)
app.register(session, {
  secret: process.env.SESSION_SECRET!,
  cookie: { secure: isProduction },
  saveUninitialized: true,
})

// register helpers
handlebars.registerHelper('eq', (a: any, b: any) => a === b)

// TODO: configure rate limit
// app.register(rateLimit, { max: 100, timeWindow: '15 minutes' })

app.get('/', (req, reply) => {
  console.log('GET / called')
  reply.view('home', { title: 'z-LLM' })
})

app.post('/initial-ask', async (req, reply) => {
  const { 'initial-question': question, model } = req.body as {
    'initial-question': string
    model: string
  }

  const streamId = crypto.randomUUID()

  try {
    const chatKey = `chat:${streamId}`
    const messagesKey = `messages:${streamId}`

    // 1. Store the chat metadata in a Hash
    await app.redis.hSet(chatKey, {
      model: model,
      createdAt: new Date().toISOString(),
      sessionId: req.session.sessionId,
      title: question.slice(0, 15),
    })

    // 2. Store the first user message in a List
    const firstMessage = JSON.stringify({
      role: 'user',
      content: question,
    })
    await app.redis.rPush(messagesKey, firstMessage)

    // 3. Associate chat with session
    const sessionChatsKey = `session:${req.session.sessionId}:chats`
    await app.redis.rPush(sessionChatsKey, streamId)

    app.log.info(
      `Started new chat: ${chatKey} (session ${req.session.sessionId})`,
    )
  } catch (err) {
    app.log.error('Failed to save initial chat to Redis', err)
  }

  return reply.view('partials/chat.hbs', {
    id: streamId,
    model,
    question,
  })
})

app.post('/new-ask/:id', async (req, reply) => {
  const { id } = req.params as { id: string }
  const { 'chat-question': question } = req.body as { 'chat-question': string }

  const messagesKey = `messages:${id}`

  try {
    // Save the new user prompt to the Redis list
    const userMessage = JSON.stringify({
      role: 'user',
      content: question,
    })
    await app.redis.rPush(messagesKey, userMessage)
    app.log.info(`Saved new prompt to ${messagesKey}`)

    // Get the model from the chat metadata
    const chatData = await app.redis.hGetAll(`chat:${id}`)

    // Respond with a partial that will trigger the stream
    return reply.view('partials/chat-bubbles.hbs', {
      id: id,
      model: chatData.model,
      question: question,
    })
  } catch (err) {
    app.log.error('Failed to save new prompt to Redis', err)
  }
})

app.get('/stream/:id/:model', async (req, reply) => {
  const { id /* model */ } = req.params as {
    id: string
    model: string
  }
  const model = 'openai/gpt-oss-120b'

  const messagesKey = `messages:${id}`

  try {
    const historyStrings = await app.redis.lRange(messagesKey, 0, -1)
    const messages = historyStrings.map((msg) => JSON.parse(msg))

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    // const response = await fetch(`${ollamaUrl}/api/chat`, {
    //   // Correctly using /api/chat
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     model,
    //     messages: history,
    //   }),
    // })
    // console.log('messages', messages)
    const response = await fetch(
      'https://router.huggingface.co/v1/chat/completions',
      {
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
          model,
          messages,
          stream: true,
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullResponse = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()

            if (data === '[DONE]') {
              console.log('\n✨ Stream complete!')
              // Ensure the stream is closed properly
              if (!reply.raw.writableEnded) {
                reply.raw.end()
              }
              return
            }

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content

              if (content) {
                fullResponse += content
                process.stdout.write(content)

                // TODO: stream content to client
                const formattedContent = content.replace(/\n/g, '<br>')
                reply.raw.write(`data: ${formattedContent}\n\n`)
              }
            } catch (e) {
              // Silently ignore JSON parse errors
              continue
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
    // TODO: Save fullResponse to DB
  } catch (err) {
    app.log.error('Error in stream route', err)
    if (!reply.raw.writableEnded) {
      reply.raw.end()
    }
  }
})

app.get('/new-chat', (req, reply) => {
  reply.view('partials/ask-form.hbs')
})

app.get('/chat-history', async (req, reply) => {
  const sessionChatsKey = `session:${req.session.sessionId}:chats`
  const chatIds = await app.redis.lRange(sessionChatsKey, 0, -1)

  const chats = []
  for (const id of chatIds) {
    const chatData = await app.redis.hGetAll(`chat:${id}`)
    chats.push({ id, ...chatData })
  }
  console.log('chats', chats)

  return reply.view('partials/chat-list.hbs', { chats })
})

app.get('/chat/:id', async (req, reply) => {
  const { id } = req.params as { id: string }

  const chatKey = `chat:${id}`
  const messagesKey = `messages:${id}`

  const chatMeta = await app.redis.hGetAll(chatKey)
  const messages = await app.redis.lRange(messagesKey, 0, -1)
  const parsedMessages = messages.map((m) => {
    const msg = JSON.parse(m)

    // format markdown for assistant messages
    if (msg.role === 'assistant') {
      msg.content = marked.parse(msg.content)
    }

    return msg
  })

  return reply.view('partials/existing-chat.hbs', {
    id,
    model: chatMeta.model,
    messages: parsedMessages,
  })
})

const start = async () => {
  console.log('Starting Fastify server...')

  try {
    await app.listen({ port: 3000, host: '0.0.0.0' })
    console.log('🚀 Server running at http://localhost:3000')
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
