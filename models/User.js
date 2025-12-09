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

module.exports = {
  User: mongoose.model('User', UserSchema),
};
