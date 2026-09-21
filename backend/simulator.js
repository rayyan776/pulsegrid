// simulator.js — PulseGrid producer process
const { client, connectRedis } = require('./redisClient');
const metricsQueue = require('./queue');
const config = require('./config');

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
    // DEL before HSET, not just HSET: HSET only touches the fields you pass
    // it, so any field left over from a previous schema (or, on a shared
    // Redis instance, from an entirely different app that happens to reuse
    // "device:{id}" as a key name) would sit there forever and leak into
    // GET /api/devices. The redisKeyPrefix namespacing below closes the
    // cross-app collision; this closes the same-app schema-drift case.
    const deviceKey = `${config.redisKeyPrefix}:device:${deviceId}`;
    await client.del(deviceKey);
    await client.hSet(deviceKey, {
      cpu: String(metrics.cpu),
      memory: String(metrics.memory),
      latency: String(metrics.latency),
    });

    // The presence key is the actual liveness signal — it expires on its own
    // if this device stops ticking, so GET /api/devices can report real
    // online/offline instead of a hardcoded, always-true status field.
    await client.set(`${config.redisKeyPrefix}:presence:${deviceId}`, 'alive', { EX: config.presenceTtlSeconds });

    await metricsQueue.add('process-reading', { deviceId, ...metrics });

    console.log(`[${new Date().toISOString()}] ${deviceId} ->`, metrics);
  } catch (err) {
    console.error(`Failed to update ${deviceId}:`, err.message);
  }
}

async function tick() {
  await Promise.all(config.deviceIds.map((id) => simulateDeviceReading(id)));
}

async function start() {
  await connectRedis();
  await tick();
  setInterval(tick, config.simulatorTickMs);
}

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection in simulator process:', err);
});

start();
