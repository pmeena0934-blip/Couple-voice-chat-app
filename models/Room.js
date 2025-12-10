// models/Room.js (Complete New File)

const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
    roomId: { // Simple ID (e.g., 101, 102)
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    ownerUsername: {
        type: String,
        required: true,
        ref: 'User'
    },
    isVIP: {
        type: Boolean,
        default: false
    },
    vipExpiry: { // Only for VIP rooms
        type: Date,
        default: null
    },
    activeUsers: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Room = mongoose.model('Room', RoomSchema);

module.exports = Room;
