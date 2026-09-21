// worker.js — PulseGrid ETL consumer process
const { createClient } = require('redis');
const { Worker, UnrecoverableError } = require('bullmq');
const connectMongo = require('./db');
const Metric = require('./models/Metric');
const DeadLetter = require('./models/DeadLetter');
const config = require('./config');

const ROLLING_KEY_PREFIX = `${config.redisKeyPrefix}:rolling:`;
const ROLLING_KEY_TTL_SECONDS = 3600;

// Rolling-average state used to live in a plain in-process object, keyed by
// deviceId — that pins the app to exactly one worker process forever: a
// second replica would see only the readings BullMQ happened to route to it,
// and compute a different, wrong rolling average for the same device. Redis
// (via the same connection already open for pub/sub below) makes this state
// shared, so any number of worker replicas converge on the same numbers.
// rPush+lTrim+lRange run inside a MULTI so a concurrent update for the same
// device (another replica, or another job in this worker's own concurrency
// pool) can't interleave and corrupt the window.
async function updateRollingAverage(redisClient, deviceId, cpu) {
  const key = `${ROLLING_KEY_PREFIX}${deviceId}`;
  const results = await redisClient.multi()
    .rPush(key, String(cpu))
    .lTrim(key, -config.rollingWindow, -1)
    .lRange(key, 0, -1)
    .expire(key, ROLLING_KEY_TTL_SECONDS)
    .exec();

  const values = results[2].map(Number);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

async function start() {
  await connectMongo();

  const redisClient = createClient({ socket: config.redis });
  redisClient.on('error', (err) => console.error('Redis client error:', err.message));
  await redisClient.connect();

  const worker = new Worker(
    'metrics-processing',
    async (job) => {
      const { deviceId, cpu, memory, latency, timestamp } = job.data;

      // Validated up front, before anything touches shared state: the
      // rolling-average Redis list is per-device, so pushing a bad cpu value
      // onto it (e.g. NaN from a malformed payload) would corrupt every
      // future legitimate reading's rolling average for that device until
      // the window ages the bad value out — even though this job itself is
      // never going to succeed. UnrecoverableError also skips BullMQ's
      // retry/backoff entirely: malformed input fails the exact same way on
      // every attempt, so retrying it is pure wasted time.
      if (
        typeof deviceId !== 'string' || !deviceId ||
        !Number.isFinite(cpu) || !Number.isFinite(memory) ||
        !Number.isFinite(latency) || !Number.isFinite(timestamp)
      ) {
        throw new UnrecoverableError(`Malformed job payload: ${JSON.stringify(job.data)}`);
      }

      const rollingAvgCpu = await updateRollingAverage(redisClient, deviceId, cpu);
      const isOverThreshold = cpu > config.cpuAlertThreshold;

      const transformed = {
        deviceId,
        cpu,
        memory,
        latency,
        timestamp,
        rollingAvgCpu: Math.round(rollingAvgCpu * 100) / 100,
        alert: isOverThreshold,
      };

      // Upsert on (deviceId, timestamp) instead of create(): BullMQ's
      // at-least-once delivery means this job can run more than once for the
      // exact same reading (e.g. a retry after the publish below failed) —
      // create() would insert a second Metric doc for it every time.
      const savedMetric = await Metric.findOneAndUpdate(
        { deviceId, timestamp },
        transformed,
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      await redisClient.publish(`${config.redisKeyPrefix}:device-updates`, JSON.stringify(transformed));
      console.log('Saved to MongoDB:', savedMetric._id.toString());

      if (isOverThreshold) {
        console.log(`ALERT: ${deviceId} CPU at ${cpu}% (threshold ${config.cpuAlertThreshold}%)`);
      }

      return transformed;
    },
    { connection: config.redis, prefix: config.redisKeyPrefix, concurrency: config.workerConcurrency },
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed for ${job.data.deviceId}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
    if (!job) return;

    // Only once this job has no more retries coming: either normal attempts
    // are exhausted, or it was thrown as an UnrecoverableError (malformed
    // input above), which BullMQ stops retrying immediately regardless of
    // attemptsMade — checking attemptsMade alone would miss that case, since
    // it fails on attempt 1 of 3 and looks identical to "still has retries".
    const attemptsAllowed = job.opts.attempts ?? 1;
    const isTerminal = err instanceof UnrecoverableError || job.attemptsMade >= attemptsAllowed;
    if (!isTerminal) return;

    DeadLetter.create({
      jobId: String(job.id),
      queue: job.queueName,
      data: job.data,
      error: err.message,
      attemptsMade: job.attemptsMade,
    }).catch((dlErr) => console.error('Failed to record dead-lettered job:', dlErr.message));
  });
}

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection in worker process:', err);
});

start();
