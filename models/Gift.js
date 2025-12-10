// models/Gift.js (Complete New File)

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
        min: 1 // Minimum cost is 1 diamond
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
    // For large gifts (e.g., 1 lakh diamond), we can trigger a system announcement
    isSuperGift: {
        type: Boolean,
        default: false
    }
});

const Gift = mongoose.model('Gift', GiftSchema);

module.exports = Gift;
      
