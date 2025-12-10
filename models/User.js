// models/User.js (Complete File - FINAL FIX for User Model loading issue)
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    diamonds: {
        type: Number,
        default: 500, 
    },
    coins: {
        type: Number,
        default: 0,
    },
    level: {
        type: Number,
        default: 1
    },
    experiencePoints: {
        type: Number,
        default: 0
    },
    profilePic: {
        type: String,
        default: 'https://i.pravatar.cc/150?img=3' 
    },
    roomName: {
        type: String,
        default: 'My Couple Chat Room'
    },
    inventory: {
        type: [String], 
        default: []
    }
});

// **--- CRITICAL FIX ---**
// Ensure the model is not recompiled if it already exists in the cache.
const User = mongoose.models.User || mongoose.model('User', UserSchema);

module.exports = User;
