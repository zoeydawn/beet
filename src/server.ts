import Fastify from 'fastify'
import type { FastifyRequest, FastifyReply } from 'fastify'
import view from '@fastify/view'
import handlebars from 'handlebars'
import path from 'path'
import fs from 'fs'
import fastifyStatic from '@fastify/static'
import formBody from '@fastify/formbody'
import session from '@fastify/session'
import cookie from '@fastify/cookie'
import * as bcrypt from 'bcryptjs'
// import rateLimit from '@fastify/rate-limit'
import { marked } from 'marked'
import jwt from 'jsonwebtoken'
const { sign, verify } = jwt

import dotenv from 'dotenv'
dotenv.config()

const isProduction = process.env.NODE_ENV === 'production'
const HF_TOKEN = process.env.HUGGING_FACE_API_KEY
const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRY = '7d' // token expiry time // TODO: update this
const SESSION_SECRET = process.env.SESSION_SECRET
const USER_KEY_PREFIX = 'user:'

import redisPlugin from './plugins/redis.ts'
import { models, createModelGroups } from './utils/models.ts'

// Check for required secrets
if (!JWT_SECRET) {
  console.error('JWT_SECRET is not defined. Please check your .env file.')
  process.exit(1)
}

if (!SESSION_SECRET) {
  console.error('SESSION_SECRET is not defined. Please check your .env file.')
  process.exit(1)
}

// include user data extracted from JWT
declare module 'fastify' {
  interface FastifyRequest {
    userId?: string
    username?: string
  }
}

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

// needed for the anonymous fallback.
app.register(cookie)
app.register(session, {
  secret: SESSION_SECRET,
  cookie: { secure: isProduction },
  saveUninitialized: true,
})

// register helpers
handlebars.registerHelper('eq', (a: any, b: any) => a === b)
// handlebars.registerHelper('isLoggedIn', (req: any) => !!req.userId)
handlebars.registerHelper('isLoggedIn', (context: any) => !!context.user)

// TODO: configure rate limit
// app.register(rateLimit, { max: 100, timeWindow: '15 minutes' })

// --- UTILITY FUNCTIONS ---

/**
 * Executes JWT verification if a token is present, setting req.userId/username.
 * Does NOT block the request if no token is present.
 */
const optionalVerifyJWT = async (req: FastifyRequest, reply: FastifyReply) => {
  const token = req.cookies.auth_token // Get the JWT from the cookie

  if (!token) {
    // No token, this is an anonymous user. Do nothing and proceed.
    return
  }

  try {
    const decoded = verify(token, JWT_SECRET!) as {
      userId: string
      username: string
      iat: number
      exp: number
    }

    // Attach user data to the request object
    req.userId = decoded.userId
    req.username = decoded.username
  } catch (err) {
    app.log.warn('Invalid or expired token. Clearing cookie.')
    // Clear the bad token but allow the request to proceed as anonymous
    reply.clearCookie('auth_token')
  }
}

/**
 * Returns the Redis key prefix for saving chats, prioritizing JWT user ID over Session ID.
 */
const getChatKeyPrefix = (req: FastifyRequest) => {
  // Priority 1: Logged-in user ID from JWT
  if (req.userId) {
    return `user:${req.userId}`
  }
  // Priority 2: Anonymous session ID (still provided by the session plugin)
  // This is used to track anonymous history.
  return `session:${req.session.sessionId}`
}

app.get('/', { preHandler: optionalVerifyJWT }, (req, reply) => {
  console.log('GET / called')

  const modelGroups = createModelGroups(models)
  // Pass user data if logged in
  const user = req.userId ? { username: req.username } : null

  reply.view('home', {
    title: 'Beet - Ultra lightweight AI chat',
    modelGroups,
    user,
  })
})

app.get('/login', (req, reply) => {
  reply.view('login.hbs')
})

app.get('/register', (req, reply) => {
  reply.view('register.hbs')
})

app.post('/login', async (req, reply) => {
  const { username, password } = req.body as any
  const userId = username.toLowerCase()
  const userKey = `${USER_KEY_PREFIX}${userId}`

  const existingUser = await app.redis.hGetAll(userKey)

  // 1. Check if user exists
  if (Object.keys(existingUser).length === 0) {
    // Return a generic error message for security
    return reply.view('login.hbs', {
      title: 'Beet - Ultra lightweight AI chat',
      errorMessage: 'Invalid username or password.',
    })
  }

  // 2. Compare the provided password with the stored hash
  const isMatch = await bcrypt.compare(password, existingUser.passwordHash)

  if (isMatch) {
    // Login successful (Steps 3, 4, 5 from /register logic, but simpler)
    const payload = { userId, username: existingUser.username }
    const token = sign(payload, JWT_SECRET!, { expiresIn: JWT_EXPIRY })

    reply.setCookie('auth_token', token, {
      httpOnly: true,
      secure: isProduction,
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    })

    app.log.info(`User logged in: ${existingUser.username} (via JWT)`)
    return reply.redirect('/')
  }

  // Password mismatch
  reply.view('login.hbs', {
    title: 'Beet - Ultra lightweight AI chat',
    errorMessage: 'Invalid username or password.',
  })
})

/**
 * Endpoint to register a new user.
 * POST /register
 */
app.post('/register', async (req, reply) => {
  const {
    username,
    password,
    'confirm-password': confirmPassword, // Destructure with a clean name
  } = req.body as any

  // 1. Validation (Basic checks)
  if (!username || !password || !confirmPassword) {
    return reply.view('register.hbs', {
      // Render the login page which contains the form
      title: 'Beet - Ultra lightweight AI chat',
      errorMessage: 'All fields are required.',
    })
  }

  if (password !== confirmPassword) {
    return reply.view('register.hbs', {
      title: 'Beet - Ultra lightweight AI chat',
      errorMessage: 'Passwords do not match.',
    })
  }

  // 2. Check for existing user in Redis
  const userId = username.toLowerCase()
  const userKey = `${USER_KEY_PREFIX}${userId}`

  const existingUser = await app.redis.hGetAll(userKey)

  if (Object.keys(existingUser).length > 0) {
    return reply.view('register.hbs', {
      title: 'Beet - Ultra lightweight AI chat',
      errorMessage: 'Username already taken.',
    })
  }

  // 3. Hash the password
  const salt = await bcrypt.genSalt(10) // 10 rounds is standard
  const hashedPassword = await bcrypt.hash(password, salt)

  // 4. Save the new user to Redis Hash
  try {
    await app.redis.hSet(userKey, {
      id: userId,
      username: username, // Save original casing for display
      passwordHash: hashedPassword,
      createdAt: new Date().toISOString(),
    })
    app.log.info(`New user registered: ${username}`)
  } catch (err) {
    app.log.error('Failed to save new user to Redis', err)
    return reply.view('login.hbs', {
      title: 'Beet - Ultra lightweight AI chat',
      errorMessage: 'Account creation failed due to a server error.',
    })
  }

  // 5. Registration successful - Log the user in immediately

  // This logic is duplicated from the /login route, but it's okay for now.
  const payload = { userId, username }
  const token = sign(payload, JWT_SECRET!, { expiresIn: JWT_EXPIRY })

  reply.setCookie('auth_token', token, {
    httpOnly: true,
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  })

  // Redirect to the home page
  return reply.redirect('/')
})

// SECURED ROUTE (Logout)
app.post('/logout', { preHandler: optionalVerifyJWT }, async (req, reply) => {
  // 1. Clear the JWT cookie (stateless logout)
  reply.clearCookie('auth_token', {
    httpOnly: true,
    secure: isProduction,
    path: '/',
  })

  app.log.info('User logged out.')

  const user = undefined // Ensure the 'user' object is not present in the context

  reply.header('HX-Retarget', '#drawer') // Target the drawer

  return reply.view('partials/drawer-content.hbs', { user })
})

app.post(
  '/initial-ask',
  { preHandler: optionalVerifyJWT },
  async (req, reply) => {
    const { 'chat-question': question, model } = req.body as {
      'chat-question': string
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
        // Store userId or a placeholder if anonymous
        userId: req.userId || `session:${req.session.sessionId}`,
        title: question.slice(0, 15),
      })

      // 2. Store the first user message in a List
      const firstMessage = JSON.stringify({
        role: 'user',
        content: question,
      })
      await app.redis.rPush(messagesKey, firstMessage)

      // 3. Associate chat with user/session
      const userChatsKeyPrefix = getChatKeyPrefix(req)
      const sessionChatsKey = userChatsKeyPrefix + ':chats'
      await app.redis.rPush(sessionChatsKey, streamId)

      app.log.info(
        `Started new chat: ${chatKey} (${req.userId ? 'user' : 'session'} ${req.userId || req.session.sessionId})`,
      )
    } catch (err) {
      app.log.error('Failed to save initial chat to Redis', err)
    }
    const modelGroups = createModelGroups(models, model)

    return reply.view('partials/chat.hbs', {
      id: streamId,
      model,
      question,
      user: { username: req.username },
      modelGroups,
    })
  },
)

app.post(
  '/new-ask/:id',
  { preHandler: optionalVerifyJWT }, // do we need this here?
  async (req, reply) => {
    const { id } = req.params as { id: string }
    const { 'chat-question': question, model } = req.body as {
      'chat-question': string
      model: string
    }

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

      if (chatData.model !== model) {
        // the model has changed, update it.
        await app.redis.hSet(`chat:${id}`, 'model', model)
      }

      // Respond with a partial that will trigger the stream
      return reply.view('partials/chat-bubbles.hbs', {
        id: id,
        model,
        question: question,
      })
    } catch (err) {
      app.log.error('Failed to save new prompt to Redis', err)
    }
  },
)

app.get(
  '/stream/:id/:model',
  { preHandler: optionalVerifyJWT }, // do we need this here?
  async (req, reply) => {
    const { id, model } = req.params as {
      id: string
      model: string
    }

    const messagesKey = `messages:${id}`

    try {
      const historyStrings = await app.redis.lRange(messagesKey, 0, -1)
      const messages = historyStrings.map((msg) => JSON.parse(msg))

      const { hfValue, maxTokens } = models[model]

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })

      const response = await fetch(
        'https://router.huggingface.co/v1/chat/completions',
        {
          headers: {
            Authorization: `Bearer ${HF_TOKEN}`,
            'Content-Type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify({
            model: hfValue,
            messages,
            stream: true,
            max_tokens: maxTokens,
          }),
        },
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      if (!response.body) {
        reply.raw.end()
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullResponse = ''

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()

              if (data === '[DONE]') {
                console.log('\n✨ Stream complete!')

                // save full response to DB
                const assistantMessage = JSON.stringify({
                  role: 'assistant',
                  content: fullResponse,
                })

                await app.redis.rPush(messagesKey, assistantMessage)
                app.log.info(`Saved assistant response to ${messagesKey}`)

                // Ensure the stream is closed properly
                if (!reply.raw.writableEnded) {
                  reply.raw.write('event: close\ndata: done\n\n')
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

                  // stream content to client
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
    } catch (err) {
      app.log.error('Error in stream route', err)
      if (!reply.raw.writableEnded) {
        reply.raw.end()
      }
    }
  },
)

app.get('/new-chat', (req, reply) => {
  const modelGroups = createModelGroups(models)
  reply.view('partials/ask-form.hbs', { modelGroups })
})

app.get(
  '/chat-history',
  { preHandler: optionalVerifyJWT },
  async (req, reply) => {
    // const sessionChatsKey = `session:${req.session.sessionId}:chats`
    const sessionChatsKey = getChatKeyPrefix(req) + ':chats'
    const chatIds = await app.redis.lRange(sessionChatsKey, 0, -1)

    const chats = []
    for (const id of chatIds) {
      const chatData = await app.redis.hGetAll(`chat:${id}`)
      chats.push({ id, ...chatData })
    }
    console.log('chats', chats)

    return reply.view('partials/chat-list.hbs', { chats })
  },
)

app.get('/login-form', (req, reply) => {
  reply.view('partials/login-form.hbs')
})

app.get('/create-account-form', (req, reply) => {
  reply.view('partials/create-account-form.hbs')
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

  const modelGroups = createModelGroups(models, chatMeta.model)

  console.log('modelGroups', modelGroups)

  if (!chatMeta.model) {
    return reply.view('partials/existing-chat.hbs', {
      id,
      model: 'gpt-3.5-turbo',
      messages: parsedMessages,
      modelGroups,
    })
  }

  return reply.view('partials/existing-chat.hbs', {
    id,
    model: chatMeta.model,
    messages: parsedMessages,
    modelGroups,
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
