// models/Metric.js
const mongoose = require('mongoose');
const config = require('../config');

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

metricSchema.index({ createdAt: 1 }, { expireAfterSeconds: config.metricTtlSeconds });

// Unique on (deviceId, timestamp): the worker upserts on this key so a BullMQ
// retry of an already-saved reading updates the existing doc instead of
// inserting a duplicate. It also covers /history's per-device, timestamp-sorted
// query, removing the in-memory sort that unindexed timestamp used to force.
metricSchema.index({ deviceId: 1, timestamp: -1 }, { unique: true });

// timestamp-only: the aggregator's raw-tier rollup matches across ALL
// devices ({ timestamp: {$gte, $lt} }, no deviceId), which the compound
// index above can't serve efficiently since deviceId is its leading key.
// Without this the aggregator re-scans the full Metric collection every
// minute, forever, growing linearly with total document count.
metricSchema.index({ timestamp: 1 });

module.exports = mongoose.model('Metric', metricSchema);
