// worker.js — PulseGrid ETL consumer process
const { createClient } = require('redis');
const { Worker } = require('bullmq');
const connectMongo = require('./db');
const Metric = require('./models/Metric');

const connection = { host: '127.0.0.1', port: 6379 };

const recentReadings = {};
const ROLLING_WINDOW = 5;
const CPU_ALERT_THRESHOLD = 90;

function updateRollingAverage(deviceId, cpu) {
  if (!recentReadings[deviceId]) recentReadings[deviceId] = [];
  recentReadings[deviceId].push(cpu);
  if (recentReadings[deviceId].length > ROLLING_WINDOW) {
    recentReadings[deviceId].shift();
  }
  const sum = recentReadings[deviceId].reduce((a, b) => a + b, 0);
  return sum / recentReadings[deviceId].length;
}

async function start() {
  await connectMongo();
 
const publisher = createClient();
await publisher.connect();  

  const worker = new Worker(
    'metrics-processing',
    async (job) => {
      const { deviceId, cpu, memory, latency, timestamp } = job.data;

      const rollingAvgCpu = updateRollingAverage(deviceId, cpu);
      const isOverThreshold = cpu > CPU_ALERT_THRESHOLD;

      const transformed = {
        deviceId,
        cpu,
        memory,
        latency,
        timestamp,
        rollingAvgCpu: Math.round(rollingAvgCpu * 100) / 100,
        alert: isOverThreshold,
      };

      const savedMetric = await Metric.create(transformed);
      await publisher.publish('device-updates', JSON.stringify(transformed));
      console.log('Saved to MongoDB:', savedMetric._id.toString());

      if (isOverThreshold) {
        console.log(`ALERT: ${deviceId} CPU at ${cpu}% (threshold ${CPU_ALERT_THRESHOLD}%)`);
      }

      return transformed;
    },
    { connection, concurrency: 5 }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed for ${job.data.deviceId}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed:`, err.message);
  });
}

start();