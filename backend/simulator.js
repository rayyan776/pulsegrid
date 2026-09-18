// simulator.js — PulseGrid producer process
const { client, connectRedis } = require('./redisClient');
const metricsQueue = require('./queue');

const DEVICE_IDS = ['device1', 'device2', 'device3', 'device4', 'device5'];

function generateMetrics() {
  return {
    cpu: Math.floor(Math.random() * 100),
    memory: Math.floor(Math.random() * 100),
    latency: Math.floor(Math.random() * 400),
    timestamp: Date.now(),
  };
}

async function simulateDeviceReading(deviceId) {
  const metrics = generateMetrics();

  try {
    await client.hSet(`device:${deviceId}`, {
      cpu: String(metrics.cpu),
      memory: String(metrics.memory),
      latency: String(metrics.latency),
      status: 'online',
    });

    await client.zAdd(`history:${deviceId}`, {
      score: metrics.timestamp,
      value: JSON.stringify(metrics),
    });

    await client.set(`presence:${deviceId}`, 'alive', { EX: 10 });


    await metricsQueue.add(
      'process-reading',
      { deviceId, ...metrics },
      { attempts: 3, backoff: { type: 'exponential', delay: 1000 } }
    );

    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    await client.zRemRangeByScore(`history:${deviceId}`, '-inf', fiveMinutesAgo);

    console.log(`[${new Date().toISOString()}] ${deviceId} ->`, metrics);
  } catch (err) {
    console.error(`Failed to update ${deviceId}:`, err.message);
  }
}

async function tick() {
  await Promise.all(DEVICE_IDS.map((id) => simulateDeviceReading(id)));
}

async function start() {
  await connectRedis();
  await tick();
  setInterval(tick, 2000);
}

start();