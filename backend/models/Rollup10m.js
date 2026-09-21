// backend/models/Rollup10m.js
const mongoose = require('mongoose');

const rollupSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  bucketStart: { type: Number, required: true },
  avgCpu: Number,
  avgMemory: Number,
  avgLatency: Number,
  maxCpu: Number,
  sampleCount: Number,
});

// Unique so the aggregator's upsert can never create two buckets for the
// same (deviceId, bucketStart) — a rerun or overlapping cron fire just
// overwrites the same document instead of double-counting.
rollupSchema.index({ deviceId: 1, bucketStart: -1 }, { unique: true });
module.exports = mongoose.model('Rollup10m', rollupSchema);
