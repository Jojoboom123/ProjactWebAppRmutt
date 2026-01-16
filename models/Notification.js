const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  title: {
    type: String,
    required: true,
    trim: true
  },
  body: {
    type: String,
    required: true,
    trim: true
  },

  // ✅ ปรับประเภทให้เหมาะกับแอพแชท
  type: {
    type: String,
    enum: ['new_message', 'room_invite', 'system_alert', 'general'],
    default: 'general'
  },

  data: {
    type: mongoose.Schema.Types.Mixed, // เก็บ roomId หรือข้อมูลอื่นๆ
    default: {}
  },

  isRead: {
    type: Boolean,
    default: false
  }
  
}, { timestamps: true });

// Index ช่วยให้ค้นหาเร็วขึ้น
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);