import Fastify from 'fastify'
import view from '@fastify/view'
import handlebars from 'handlebars'
// import session from '@fastify/session'
// import rateLimit from '@fastify/rate-limit'
import path from 'path'
import fs from 'fs'
import fastifyStatic from '@fastify/static'
import formBody from '@fastify/formbody'

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

app.post('/initial-ask', (req, reply) => {
  // Fastify automatically parses the form data into req.body
  const { 'initial-question': question, model } = req.body as {
    'initial-question': string
    model: string
  }

  // Log the received data to the console for debugging
  console.log('Received question:', question)
  console.log('Selected model:', model)

  // simulated response for now
  const simulatedAnswer = `This is a simulated answer for the question "${question}" using the ${model} model. The current time is ${new Date().toLocaleTimeString()}.`

  const responseData = {
    question: question,
    model: model,
    answer: simulatedAnswer,
    layout: false,
  }

  return reply.view('partials/chat.hbs', responseData)
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
