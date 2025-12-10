// models/User.js (Complete and Corrected File)

const mongoose = require('mongoose');

// **महत्वपूर्ण सुधार**: स्कीमा का नाम lowercase 'userSchema' है।
const userSchema = new mongoose.Schema({ 
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

// Mongoose Model बनाना
const User = mongoose.model('User', userSchema);

// मॉडल को export करना
module.exports = User;
