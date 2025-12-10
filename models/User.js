// models/User.js (Final Fix for Login Error)

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({ 
    username: { 
        type: String, 
        required: true, 
        unique: true 
    },
    diamonds: { 
        type: Number, 
        default: 500
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
    profilePic: { 
        type: String, 
        default: 'https://i.pravatar.cc/150?img=1' 
    },
    roomName: { 
        type: String, 
        default: 'My Couple Chat Room' 
    },
});

// ********** CRITICAL FIX **********
// सीधे mongoose.model को export करें, जिससे server.js में 'User' हमेशा एक Mongoose Model रहे।
module.exports = mongoose.model('User', userSchema); 
// ***********************************
