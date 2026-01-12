const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reporterUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reason: { type: String, required: true },
  status: { type: String, enum: ['pending', 'resolved', 'dismissed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', reportSchema);