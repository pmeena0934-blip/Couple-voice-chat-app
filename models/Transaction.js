// models/Transaction.js (Complete New File)

const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        ref: 'User' // Links to the User who made the payment
    },
    diamondAmount: {
        type: Number,
        required: true
    },
    fiatAmount: { // Rupee Amount (e.g., 200 Rs for 500 Diamonds)
        type: Number,
        required: true
    },
    utrNumber: {
        type: String,
        required: true,
        unique: true
    },
    screenshotUrl: { // URL where the screenshot is hosted
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    approvedBy: { // Admin's username who approved it
        type: String,
        default: null
    }
});

const Transaction = mongoose.model('Transaction', TransactionSchema);

module.exports = Transaction;
  
