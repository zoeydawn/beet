import Fastify from 'fastify'
import view from '@fastify/view'
import handlebars from 'handlebars'
// import session from '@fastify/session'
// import rateLimit from '@fastify/rate-limit'
import path from 'path'
import fs from 'fs'
import fastifyStatic from '@fastify/static'
import formBody from '@fastify/formbody'
import dotenv from 'dotenv'
dotenv.config()

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

// TODO: configure session
// app.register(session, {
//   secret: 'super-secret',
//   cookie: { secure: false },
// })

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
    })

    // 2. Store the first user message in a List
    const firstMessage = JSON.stringify({
      role: 'user',
      content: question,
    })
    await app.redis.rPush(messagesKey, firstMessage)

    app.log.info(`Started new chat: ${chatKey}`)
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
  const { id, model } = req.params as {
    id: string
    model: string
  }

  const messagesKey = `messages:${id}`

  try {
    const historyStrings = await app.redis.lRange(messagesKey, 0, -1)
    const history = historyStrings.map((msg) => JSON.parse(msg))

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    const response = await fetch(`${ollamaUrl}/api/chat`, {
      // Correctly using /api/chat
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: history,
      }),
    })

    if (!response.body) {
      reply.raw.end()
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullResponse = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        const assistantMessage = JSON.stringify({
          role: 'assistant',
          content: fullResponse,
        })
        await app.redis.rPush(messagesKey, assistantMessage)
        app.log.info(`Saved assistant response to ${messagesKey}`)
        break
      }

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter(Boolean)

      for (const line of lines) {
        try {
          const json = JSON.parse(line)

          if (json.message && json.message.content) {
            const content = json.message.content

            const formattedContent = content.replace(/\n/g, '<br>')
            fullResponse += formattedContent
            reply.raw.write(`data: ${formattedContent}\n\n`)
          }

          if (json.done) {
            reply.raw.write('event: close\ndata: done\n\n')
            reply.raw.end()
          }
        } catch {
          // skip malformed JSON
        }
      }
    }
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
