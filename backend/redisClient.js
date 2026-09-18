// redisClient.js
const { createClient } = require('redis');

const client = createClient(); // defaults to localhost:6379

client.on('connect', () => console.log('Connected to Redis'));
client.on('error', (err) => console.error('Redis error:', err));

async function connectRedis() {
  await client.connect();
}

module.exports = { client, connectRedis };