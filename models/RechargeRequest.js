// models/RechargeRequest.js
const mongoose = require('mongoose');

const RechargeRequestSchema = new mongoose.Schema({
    username: { type: String, required: true },
    planId: { type: String, required: true },
    diamondAmount: { type: Number, required: true }, // Total diamonds to be credited
    paidAmount: { type: Number, required: true }, // Amount paid in INR
    utrNumber: { type: String, required: true, unique: true }, // UTR/Transaction ID
    screenshotUrl: { type: String }, // URL where the screenshot is stored
    status: { 
        type: String, 
        enum: ['pending', 'accepted', 'rejected'], 
        default: 'pending' 
    },
    adminActionBy: { type: String }, // Admin who accepted/rejected it
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('RechargeRequest', RechargeRequestSchema);
