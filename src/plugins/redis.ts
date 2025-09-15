import type { FastifyInstance } from 'fastify'
import { createClient } from 'redis'
import fp from 'fastify-plugin'

// Define the type for your Redis client
export type RedisClient = ReturnType<typeof createClient>

// Define the Fastify plugin
async function redisPlugin(fastify: FastifyInstance) {
  const redisUrl = process.env.REDIS_URL

  if (!redisUrl) {
    fastify.log.error('Redis URL is not defined. Please check your .env file.')
    // Stop the server from starting if Redis is essential
    process.exit(1)
  }

  const client = createClient({
    // TODO: move redis url to env
    url: redisUrl,
  })

  client.on('error', (err) => fastify.log.error('Redis Client Error', err))

  try {
    await client.connect()
    fastify.log.info('Successfully connected to Redis.')

    // Decorate the Fastify instance with the Redis client
    fastify.decorate('redis', client)

    // Add a hook to close the connection when the server shuts down
    fastify.addHook('onClose', async (instance) => {
      await client.quit()
      instance.log.info('Redis connection closed.')
    })
  } catch (err) {
    fastify.log.error('Failed to connect to Redis.', err)
    // Optional: exit the process if Redis is essential for your app
    // process.exit(1)
  }
}

// Wrap the plugin with fastify-plugin
export default fp(redisPlugin)

// Augment the Fastify instance type to include the 'redis' decorator
declare module 'fastify' {
  export interface FastifyInstance {
    redis: RedisClient
  }
}
