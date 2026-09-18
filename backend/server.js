// server.js — PulseGrid API + Socket.IO process
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('redis');
const mongoose = require('mongoose');
const Metric = require('./models/Metric');
const Rollup1m = require('./models/Rollup1m');
const Rollup10m = require('./models/Rollup10m');
const Rollup1h = require('./models/Rollup1h');
const ROLLUP_MODELS = { '1m': Rollup1m, '10m': Rollup10m, '1h': Rollup1h };

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }, // tighten to the Angular dev origin later
});

const DEVICE_IDS = ['device1', 'device2', 'device3', 'device4', 'device5'];

async function start() {
  await mongoose.connect('mongodb://127.0.0.1:27017/pulsegrid');
  console.log('Connected to MongoDB');

  const redisClient = createClient();
  const redisSubscriber = redisClient.duplicate();

  await redisClient.connect();
  await redisSubscriber.connect();
  console.log('Connected to Redis (2 connections: commands + subscriber)');

  app.get('/api/devices', async (req, res) => {
    try {
      const devices = await Promise.all(
        DEVICE_IDS.map(async (id) => {
          const data = await redisClient.hGetAll(`device:${id}`);
          return { deviceId: id, ...data };
        })
      );
      res.json(devices);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch devices' });
    }
  });

  app.get('/api/devices/:id/aggregates', async (req, res) => {
  const { id } = req.params;
  const interval = req.query.interval || '1m';
  const minutes = parseInt(req.query.minutes) || 60;
  const since = Date.now() - minutes * 60 * 1000;

  const Model = ROLLUP_MODELS[interval];
  if (!Model) return res.status(400).json({ error: 'interval must be 1m, 10m, or 1h' });

  const data = await Model.find({ deviceId: id, bucketStart: { $gte: since } }).sort({ bucketStart: 1 });
  res.json(data);
});

  app.get('/api/devices/:id/history', async (req, res) => {
    try {
      const { id } = req.params;
      const minutes = parseInt(req.query.minutes) || 60;
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

  await redisSubscriber.subscribe('device-updates', (message) => {
    const data = JSON.parse(message);
    io.emit('deviceUpdate', data);
  });

  io.on('connection', (socket) => {
    console.log(`Browser connected: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`Browser disconnected: ${socket.id}`);
    });
  });

  const PORT = 4000;
  server.listen(PORT, () => {
    console.log(`PulseGrid API listening on http://localhost:${PORT}`);
  });
}

start();