const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true, 
        unique: true, // ห้ามชื่อแท็กซ้ำกัน
        trim: true 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('Tag', tagSchema);