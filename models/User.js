// models/User.js (Complete File - FINAL FIX for User Model loading issue)
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    // New users get 500 free diamonds
    diamonds: {
        type: Number,
        default: 500, 
    },
    // Gold coins for smaller transactions (optional)
    coins: {
        type: Number,
        default: 0,
    },
    // Experience Points / Level System
    level: {
        type: Number,
        default: 1
    },
    experiencePoints: {
        type: Number,
        default: 0
    },
    
    // Fields for Profile/Room Editing
    profilePic: {
        type: String,
        default: 'https://i.pravatar.cc/150?img=3' // Default avatar
    },
    roomName: {
        type: String,
        default: 'My Couple Chat Room'
    },
    // Inventory (e.g., for storing bought frames, cars, etc.)
    inventory: {
        type: [String], // Array of owned item names/IDs
        default: []
    }
});

// **--- CRITICAL FIX ---**
// यदि 'User' मॉडल पहले से मौजूद है (cache में), तो उसे उपयोग करें, अन्यथा नया बनाएं।
// यह 'User.findOne is not a function' एरर को पूरी तरह से हल करता है।
const User = mongoose.models.User || mongoose.model('User', UserSchema);

module.exports = User;
