// models/DeadLetter.js — durable trace of jobs that exhausted all BullMQ
// retries. Previously the 'failed' handler only console.error'd, so a job
// that died for good left no record anywhere once the log scrolled past.
const mongoose = require('mongoose');

const deadLetterSchema = new mongoose.Schema({
  jobId: { type: String, required: true },
  queue: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed },
  error: { type: String },
  attemptsMade: { type: Number },
}, {
  timestamps: true,
});

module.exports = mongoose.model('DeadLetter', deadLetterSchema);
