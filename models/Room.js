const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    title: { type: String, required: true },
    Tag: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag' }],
    description: { type: String, default: "" },
    roomImage: { type: String, default: "" },
    roomType: {
        type: String,
        enum: ['public', 'private'],
        default: 'public'
    },
    password: { type: String, default: null },

    maxParticipants: {
        type: Number,
        required: true,
        default: 30,
        min: [2, 'Room must have at least 2 participants']
    },

    location: {
        type: {
            type: String,
            enum: ['Point'],
            required: true
        },
        coordinates: {
            type: [Number],
            required: true
        }

    },
    activityDate: { type: Date, required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    bannedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: { type: Date, default: Date.now }
});
roomSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Room', roomSchema);