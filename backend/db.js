// db.js
const mongoose = require('mongoose');

async function connectMongo() {
  await mongoose.connect('mongodb://127.0.0.1:27017/pulsegrid');
  console.log('Connected to MongoDB');
}

module.exports = connectMongo;