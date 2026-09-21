// queue.js
const { Queue } = require('bullmq');
const config = require('./config');

// Consumed internally by BullMQ, which uses ioredis under the hood.
// You never call ioredis commands yourself.
const metricsQueue = new Queue('metrics-processing', {
  connection: config.redis,
  prefix: config.redisKeyPrefix,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    // Without these, BullMQ keeps every completed/failed job in Redis
    // forever — at one reading/device/tick this is ~216k stray jobs/day.
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

module.exports = metricsQueue;
