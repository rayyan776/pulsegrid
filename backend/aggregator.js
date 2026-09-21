// backend/aggregator.js
const cron = require('node-cron');
const connectMongo = require('./db');
const Metric = require('./models/Metric');
const Rollup1m = require('./models/Rollup1m');
const Rollup10m = require('./models/Rollup10m');
const Rollup1h = require('./models/Rollup1h');

// The most recently *completed* aligned window of size windowMs, as of now —
// e.g. at 12:03:27 with windowMs=60_000 this is [12:02:00, 12:03:00). Basing
// the window on epoch alignment rather than "now - windowMs" means cron
// firing a few hundred ms late never shifts which bucket a reading lands in,
// so nothing at the edges gets dropped or double-counted.
function lastCompleteWindow(windowMs) {
  const bucketStart = Math.floor(Date.now() / windowMs) * windowMs - windowMs;
  return { bucketStart, bucketEnd: bucketStart + windowMs };
}

// Tier 1: raw Metric readings -> a Rollup1m bucket.
async function rollUpFromRaw(destModel, windowMs) {
  const { bucketStart, bucketEnd } = lastCompleteWindow(windowMs);

  const results = await Metric.aggregate([
    { $match: { timestamp: { $gte: bucketStart, $lt: bucketEnd } } },
    { $group: {
        _id: '$deviceId',
        avgCpu: { $avg: '$cpu' },
        avgMemory: { $avg: '$memory' },
        avgLatency: { $avg: '$latency' },
        maxCpu: { $max: '$cpu' },
        count: { $sum: 1 },
    }},
  ]);

  await Promise.all(results.map((r) => destModel.updateOne(
    { deviceId: r._id, bucketStart },
    { $set: {
        avgCpu: r.avgCpu, avgMemory: r.avgMemory, avgLatency: r.avgLatency,
        maxCpu: r.maxCpu, sampleCount: r.count,
    }},
    { upsert: true },
  )));
}

// Tier 2/3: one Rollup collection -> the next, coarser one (e.g. 1m -> 10m).
// Child buckets are weighted by their own sampleCount so this is a true
// average of the underlying readings, not an average-of-averages.
async function rollUpFromRollup(sourceModel, destModel, windowMs) {
  const { bucketStart, bucketEnd } = lastCompleteWindow(windowMs);

  const results = await sourceModel.aggregate([
    { $match: { bucketStart: { $gte: bucketStart, $lt: bucketEnd } } },
    { $group: {
        _id: '$deviceId',
        totalSamples: { $sum: '$sampleCount' },
        weightedCpu: { $sum: { $multiply: ['$avgCpu', '$sampleCount'] } },
        weightedMemory: { $sum: { $multiply: ['$avgMemory', '$sampleCount'] } },
        weightedLatency: { $sum: { $multiply: ['$avgLatency', '$sampleCount'] } },
        maxCpu: { $max: '$maxCpu' },
    }},
  ]);

  await Promise.all(
    results
      .filter((r) => r.totalSamples > 0)
      .map((r) => destModel.updateOne(
        { deviceId: r._id, bucketStart },
        { $set: {
            avgCpu: r.weightedCpu / r.totalSamples,
            avgMemory: r.weightedMemory / r.totalSamples,
            avgLatency: r.weightedLatency / r.totalSamples,
            maxCpu: r.maxCpu,
            sampleCount: r.totalSamples,
        }},
        { upsert: true },
      )),
  );
}

// A transient Mongo error thrown inside a cron callback would otherwise be an
// unhandled promise rejection — on modern Node that crashes the whole process
// silently, mid-schedule.
function guarded(name, fn) {
  return async () => {
    try {
      await fn();
    } catch (err) {
      console.error(`[aggregator] ${name} failed:`, err);
    }
  };
}

async function start() {
  await connectMongo();

  cron.schedule('* * * * *', guarded('1m rollup', () => rollUpFromRaw(Rollup1m, 60_000)));
  cron.schedule('*/10 * * * *', guarded('10m rollup', () => rollUpFromRollup(Rollup1m, Rollup10m, 600_000)));
  cron.schedule('0 * * * *', guarded('1h rollup', () => rollUpFromRollup(Rollup10m, Rollup1h, 3_600_000)));
}

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection in aggregator process:', err);
});

start();
