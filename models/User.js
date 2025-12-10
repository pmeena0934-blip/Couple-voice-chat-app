// models/User.js (Complete File)

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        unique: true 
    },
    diamonds: { 
        type: Number, 
        default: 500 // New users get 500 free diamonds
    }, 
    coins: { 
        type: Number, 
        default: 0 
    },
    level: { 
        type: Number, 
        default: 0 
    },
    experiencePoints: { 
        type: Number, 
        default: 0 
    },
    
    // Fields for Profile/Room Editing
    profilePic: { 
        type: String, 
        default: 'https://i.pravatar.cc/150?img=1' 
    },
    roomName: { 
        type: String, 
        default: 'My Couple Chat Room' 
    },
});

const User = mongoose.model('User', UserSchema);

module.exports = User;
