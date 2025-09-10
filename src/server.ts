import Fastify from 'fastify'
import view from '@fastify/view'
import handlebars from 'handlebars'
// import session from '@fastify/session'
// import rateLimit from '@fastify/rate-limit'
import path from 'path'
import fastifyStatic from '@fastify/static'

const app = Fastify({ logger: true })

// Serve static files from the "public" folder at the root URL
app.register(fastifyStatic, {
  root: path.join(process.cwd(), 'public'),
  prefix: '/static/', // all files will be served under /static/*
})

// Register handlebars as the template engine
app.register(view, {
  engine: { handlebars },
  root: './views', // where your .hbs files live
  // layout: 'layout.hbs', // optional, if you want a base layout
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
