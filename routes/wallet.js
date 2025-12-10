// routes/wallet.js (Updated with Leveling Logic)
const express = require('express');
const router = express.Router();
const User = require('../models/User'); 
// Level Calculator को आयात करें
const { checkLevelUp } = require('../utils/levelCalculator'); 

// ********** Gifting API **********
router.post('/gift', async (req, res) => {
    const senderUsername = req.body.senderId; 
    const { receiverId, amount } = req.body; 

    if (!senderUsername || !receiverId || !amount || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid gift details.' });
    }

    try {
        let sender = await User.findOne({ username: senderUsername });
        if (!sender) {
            return res.status(404).json({ success: false, message: 'Sender user not found.' });
        }
        
        if (sender.diamonds < amount) {
            return res.status(403).json({ success: false, message: 'Insufficient diamonds.' });
        }

        // --- Transaction ---
        sender.diamonds -= amount;
        
        // प्राप्तकर्ता (Receiver) के Coins और XP को बढ़ाएँ
        let receiver = await User.findOne({ username: receiverId });
        let leveledUp = false;

        if (receiver) {
            receiver.coins += amount; 
            
            // रिसीवर को XP देना (मान लें 1 डायमंड = 1 XP)
            const XP_GAIN = amount; 
            receiver.experiencePoints += XP_GAIN;
            
            // लेवल अप चेक करें
            leveledUp = checkLevelUp(receiver);
            if (leveledUp) {
                console.log(`User ${receiver.username} leveled up to ${receiver.level}!`);
            }
            
            await receiver.save();
        } 
        
        await sender.save();

        // Socket.io से सभी को उपहार के बारे में बताएं 
        const io = req.app.get('socketio');
        // '101' को उस रूम ID से बदलें जिसमें उपहार भेजा गया है
        io.to('101').emit('gift_received', { 
            sender: senderUsername, 
            receiver: receiverId, 
            amount: amount,
            leveledUp: leveledUp, // फ्रंटेंड को सूचित करें
            newReceiverLevel: receiver ? receiver.level : 0
        });

        // सफलता का जवाब 
        return res.json({ 
            success: true, 
            message: 'Gift sent successfully!', 
            newBalance: sender.diamonds,
            newCoins: receiver ? receiver.coins : 0,
            receiverLevel: receiver ? receiver.level : 0
        });

    } catch (error) {
        console.error('Gifting API Error:', error);
        res.status(500).json({ success: false, message: 'Server error during transaction.' });
    }
});

// ********** Redemption API (100 Coins = 10 Diamonds) **********
router.post('/redeem', async (req, res) => {
    const { username, coinAmount } = req.body;
    const diamondEquivalent = Math.floor(coinAmount / 10); 
    
    if (coinAmount < 100) {
        return res.status(400).json({ success: false, message: 'Minimum 100 coins required for redemption.' });
    }

    try {
        let user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        if (user.coins < coinAmount) {
            return res.status(403).json({ success: false, message: 'Insufficient coins.' });
        }

        user.coins -= coinAmount;
        user.diamonds += diamondEquivalent;
        await user.save();

        res.json({ success: true, message: 'Redemption successful!', newDiamonds: user.diamonds, newCoins: user.coins });

    } catch (error) {
        console.error('Redeem API Error:', error);
        res.status(500).json({ success: false, message: 'Server error during redemption.' });
    }
});


module.exports = router;
                
