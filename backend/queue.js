// queue.js
const { Queue } = require('bullmq');

// Consumed internally by BullMQ, which uses ioredis under the hood.
// You never call ioredis commands yourself.
const connection = { host: '127.0.0.1', port: 6379 };

const metricsQueue = new Queue('metrics-processing', { connection });

module.exports = metricsQueue;