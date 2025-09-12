import Fastify from 'fastify'
import view from '@fastify/view'
import handlebars from 'handlebars'
// import session from '@fastify/session'
// import rateLimit from '@fastify/rate-limit'
import path from 'path'
import fs from 'fs'
import fastifyStatic from '@fastify/static'
import formBody from '@fastify/formbody'

const ollamaUrl = 'http://localhost:11434'

const app = Fastify({ logger: true })

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

  const streamId = crypto.randomUUID() // unique id for this chat message

  // TODO:
  // store this question + model + streamId somewhere
  // so your /stream/:id route knows what to stream

  return reply.view('partials/chat.hbs', {
    id: streamId,
    model,
    question,
  })
})

app.post('/new-ask', (req, reply) => {
  const { 'chat-question': question } = req.body as {
    'chat-question': string
  }

  setTimeout(() => {
    reply.view('partials/chat-bubbles.hbs', {
      question: question,
      answer: 'This is a simulated answer for the question',
    })
  }, 2000)
})

app.get('/stream/:id/:model/:prompt', async (req, reply) => {
  const { id, model, prompt } = req.params as {
    id: string
    model: string
    prompt: string
  }

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, prompt }),
  })

  if (!response.body) {
    reply.raw.end()
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n').filter(Boolean)

    for (const line of lines) {
      try {
        const json = JSON.parse(line)
        if (json.response) {
          reply.raw.write(`data: ${json.response}\n\n`)
        }
        if (json.done) {
          reply.raw.write('event: end\ndata: done\n\n')
          // close event tells to FE to spot listening
          reply.raw.write('event: close\ndata: done\n\n')
          reply.raw.end()
        }
      } catch {
        // skip malformed JSON
      }
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
