// server.js — PulseGrid API + Socket.IO process
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('redis');
const Metric = require('./models/Metric');
const Rollup1m = require('./models/Rollup1m');
const Rollup10m = require('./models/Rollup10m');
const Rollup1h = require('./models/Rollup1h');
const config = require('./config');
const connectMongo = require('./db');

const ROLLUP_MODELS = { '1m': Rollup1m, '10m': Rollup10m, '1h': Rollup1h };

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// Echoes the caller's correlation id back and logs it against the request —
// previously generated client-side (see api.interceptor.ts) and sent, but
// never read on this side.
app.use((req, res, next) => {
  const requestId = req.get('X-Request-Id');
  if (requestId) {
    res.set('X-Request-Id', requestId);
    console.log(`[${requestId}] ${req.method} ${req.originalUrl}`);
  }
  next();
});

function clampMinutes(raw, max, fallback = 60) {
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.corsOrigin }, // tighten before any non-localhost deployment
});

async function start() {
  await connectMongo();

  const redisClient = createClient({ socket: config.redis });
  const redisSubscriber = redisClient.duplicate();
  redisClient.on('error', (err) => console.error('Redis client error:', err.message));
  redisSubscriber.on('error', (err) => console.error('Redis subscriber error:', err.message));

  await redisClient.connect();
  await redisSubscriber.connect();
  console.log('Connected to Redis (2 connections: commands + subscriber)');

  // NOTE on multi-instance Socket.IO: this process already gets
  // multi-instance-correct broadcast for free, without a
  // @socket.io/redis-adapter. Every server.js instance independently
  // subscribes to the device-updates channel below and calls io.emit() on
  // its OWN socket server — so with N instances running behind a load balancer,
  // every instance's locally-connected clients get exactly one copy of
  // every update. A @socket.io/redis-adapter was tried here and reverted:
  // it adds its OWN independent cross-instance relay on top of this one,
  // so with 2+ instances every client received every 'deviceUpdate' twice
  // (once via this subscription's local emit, once via the adapter
  // re-delivering the other instance's local emit). Confirmed with a live
  // 2-instance test before reverting. If Socket.IO room/targeted-emit
  // features are ever added, revisit this — but pick ONE fan-out
  // mechanism, not both.
  app.get('/api/devices', async (req, res) => {
    try {
      const devices = await Promise.all(
        config.deviceIds.map(async (id) => {
          const [data, isPresent] = await Promise.all([
            redisClient.hGetAll(`${config.redisKeyPrefix}:device:${id}`),
            redisClient.exists(`${config.redisKeyPrefix}:presence:${id}`),
          ]);
          // Whitelisted, not spread: the hash is meant to hold exactly these
          // three fields, but Redis HSET only ever adds/updates fields, never
          // removes ones no longer written — a stale or unexpected field left
          // over from an old deploy (or a same-Redis-instance key collision)
          // would otherwise leak straight into the API response.
          return { deviceId: id, cpu: data.cpu, memory: data.memory, latency: data.latency, status: isPresent ? 'online' : 'offline' };
        })
      );
      res.json(devices);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch devices' });
    }
  });

  app.get('/api/devices/:id/aggregates', async (req, res) => {
    try {
      const { id } = req.params;
      const interval = req.query.interval || '1m';
      const minutes = clampMinutes(req.query.minutes, config.aggregatesMaxMinutes);
      const since = Date.now() - minutes * 60 * 1000;

      const Model = ROLLUP_MODELS[interval];
      if (!Model) return res.status(400).json({ error: 'interval must be 1m, 10m, or 1h' });

      const data = await Model.find({ deviceId: id, bucketStart: { $gte: since } }).sort({ bucketStart: 1 });
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch aggregates' });
    }
  });

  app.get('/api/devices/:id/history', async (req, res) => {
    try {
      const { id } = req.params;
      const minutes = clampMinutes(req.query.minutes, config.historyMaxMinutes);
      const since = Date.now() - minutes * 60 * 1000;

      const history = await Metric.find({
        deviceId: id,
        timestamp: { $gte: since },
      }).sort({ timestamp: -1 });

      res.json(history);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch history' });
    }
  });

  await redisSubscriber.subscribe(`${config.redisKeyPrefix}:device-updates`, (message) => {
    try {
      const data = JSON.parse(message);
      io.emit('deviceUpdate', data);
    } catch (err) {
      console.error('Discarding malformed device-updates message:', err.message);
    }
  });

  io.on('connection', (socket) => {
    console.log(`Browser connected: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`Browser disconnected: ${socket.id}`);
    });
  });

  server.listen(config.port, () => {
    console.log(`PulseGrid API listening on http://localhost:${config.port}`);
  });
}

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection in server process:', err);
});

start();
