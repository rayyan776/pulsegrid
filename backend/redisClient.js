// redisClient.js
const { createClient } = require('redis');
const config = require('./config');

const client = createClient({ socket: { host: config.redis.host, port: config.redis.port } });

client.on('connect', () => console.log('Connected to Redis'));
client.on('error', (err) => console.error('Redis error:', err.message));

async function connectRedis() {
  await client.connect();
}

module.exports = { client, connectRedis };
