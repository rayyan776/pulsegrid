// config.js — single source of deploy-time settings, overridable via env vars.
try {
  require('dotenv').config();
} catch {
  // dotenv isn't installed — plain process.env values (e.g. set by the
  // shell or a process manager) still work fine without it.
}

function envInt(name, fallback) {
  const value = parseInt(process.env[name], 10);
  return Number.isFinite(value) ? value : fallback;
}

const DEFAULT_DEVICE_IDS = ['device1', 'device2', 'device3', 'device4', 'device5'];

module.exports = {
  port: envInt('PORT', 4000),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pulsegrid',
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: envInt('REDIS_PORT', 6379),
  },
  // Every PulseGrid-owned Redis key (device:, presence:, rolling:) and the
  // BullMQ queue's own keys are namespaced under this prefix. Redis has no
  // per-app isolation on a shared instance/default DB — without a prefix,
  // any other local app that happens to pick generic key names like
  // "device:{id}" on the same host:port silently collides with this one
  // (confirmed: a stray "errorCount" field turned up on a device hash that
  // no PulseGrid code has ever written).
  redisKeyPrefix: process.env.REDIS_KEY_PREFIX || 'pulsegrid',
  deviceIds: process.env.DEVICE_IDS
    ? process.env.DEVICE_IDS.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_DEVICE_IDS,
  cpuAlertThreshold: envInt('CPU_ALERT_THRESHOLD', 90),
  rollingWindow: envInt('ROLLING_WINDOW', 5),
  workerConcurrency: envInt('WORKER_CONCURRENCY', 5),
  simulatorTickMs: envInt('SIMULATOR_TICK_MS', 2000),
  presenceTtlSeconds: envInt('PRESENCE_TTL_SECONDS', 10),
  // Raw Metric docs are TTL-deleted after this many seconds — must cover the
  // longest raw-history window the UI offers (device-detail's "3h" tab).
  metricTtlSeconds: envInt('METRIC_TTL_SECONDS', 3 * 60 * 60),
  // Upper bound for ?minutes= on /history (serves raw Metric docs, so this
  // should track metricTtlSeconds — asking further back than the TTL keeps
  // data is pointless).
  historyMaxMinutes: envInt('HISTORY_MAX_MINUTES', 180),
  // Upper bound for ?minutes= on /aggregates (serves Rollup docs, which live
  // far longer than raw Metric docs, so this cap is much larger).
  aggregatesMaxMinutes: envInt('AGGREGATES_MAX_MINUTES', 60 * 24 * 30),
  corsOrigin: process.env.CORS_ORIGIN || '*',
};
