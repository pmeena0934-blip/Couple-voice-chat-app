// models/Gift.js (Complete File - UPDATED for Entry Effect)

const mongoose = require('mongoose');

const GiftSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    diamondCost: {
        type: Number,
        required: true,
        min: 1 
    },
    category: {
        type: String,
        enum: ['Small', 'Medium', 'Car', 'SuperGift', 'EntryEffect'],
        required: true
    },
    imageUrl: {
        type: String,
        required: true
    },
    isSuperGift: {
        type: Boolean,
        default: false
    },
    // NEW: Field to trigger special entry effects
    entryEffect: {
        type: String,
        enum: [null, 'car', 'plane', 'frame'],
        default: null
    }
});

const Gift = mongoose.model('Gift', GiftSchema);

module.exports = Gift;
