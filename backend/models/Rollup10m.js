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

rollupSchema.index({ deviceId: 1, bucketStart: -1 });
module.exports = mongoose.model('Rollup10m', rollupSchema);