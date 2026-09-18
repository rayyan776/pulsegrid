// backend/aggregator.js
const cron = require('node-cron'); // npm install node-cron
const connectMongo = require('./db');
const Metric = require('./models/Metric');
const Rollup1m = require('./models/Rollup1m');
const Rollup10m = require('./models/Rollup10m');
const Rollup1h = require('./models/Rollup1h');

async function rollUp(sourceModel, destModel, windowMs) {
  const end = Date.now();
  const start = end - windowMs;
  const bucketStart = Math.floor(start / windowMs) * windowMs;

  const results = await sourceModel.aggregate([
    { $match: { timestamp: { $gte: start, $lt: end } } },
    { $group: {
        _id: '$deviceId',
        avgCpu: { $avg: '$cpu' },
        avgMemory: { $avg: '$memory' },
        avgLatency: { $avg: '$latency' },
        maxCpu: { $max: '$cpu' },
        count: { $sum: 1 },
    }},
  ]);

  await Promise.all(results.map((r) => destModel.create({
    deviceId: r._id,
    bucketStart,
    avgCpu: r.avgCpu, avgMemory: r.avgMemory, avgLatency: r.avgLatency,
    maxCpu: r.maxCpu, sampleCount: r.count,
  })));
}

async function start() {
  await connectMongo();

  cron.schedule('* * * * *', () => rollUp(Metric, Rollup1m, 60_000));          // every minute, from raw
  cron.schedule('*/10 * * * *', () => rollUp(Rollup1m, Rollup10m, 600_000));   // every 10 min, from 1m rollups
  cron.schedule('0 * * * *', () => rollUp(Rollup10m, Rollup1h, 3_600_000));    // every hour, from 10m rollups
}

start();