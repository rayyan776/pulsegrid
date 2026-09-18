// models/Metric.js
const mongoose = require('mongoose');

const metricSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  cpu: { type: Number, required: true },
  memory: { type: Number, required: true },
  latency: { type: Number, required: true },
  rollingAvgCpu: { type: Number },
  alert: { type: Boolean, default: false },
  timestamp: { type: Number, required: true }, // epoch ms
}, {
  timestamps: true,
});

metricSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

module.exports = mongoose.model('Metric', metricSchema);