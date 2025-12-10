const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  avatar: { type: String, default: 'default_avatar.png' },
  // Phase 2: Leveling Data
  level: { type: Number, default: 1 },
  experiencePoints: { type: Number, default: 0 },
  // Phase 2: Economy (Gifting)
  diamonds: { type: Number, default: 1000 }, // Sending currency (Testing: initial balance)
  coins: { type: Number, default: 0 },    // Received currency
  role: { type: String, default: 'user' }, 
  isOnline: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// ********** [बदलाव: मॉडल एक्सपोर्ट को ठीक किया गया] **********
module.exports = mongoose.model('User', UserSchema); 
// अब यह सीधे Mongoose मॉडल को एक्सपोर्ट करता है, जिससे server.js में findOne() काम करेगा।
// ************************************************************
