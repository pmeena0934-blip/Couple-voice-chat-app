const express = require('express');
const router = express.Router();
const User = require('../models/User'); // User model को लोड करें

// ********** /api/wallet/gift रूट **********
router.post('/gift', async (req, res) => {
    // Note: server.js से X-User-ID हेडर आ रहा है, लेकिन हम उसे यहां req.body से भी ले सकते हैं
    const senderUsername = req.body.senderId; 
    const { receiverId, amount } = req.body; // मान लें receiverId होस्ट है

    if (!senderUsername || !receiverId || !amount || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid gift details.' });
    }

    try {
        // 1. भेजने वाले का बैलेंस चेक करें
        let sender = await User.findOne({ username: senderUsername });
        if (!sender) {
            return res.status(404).json({ success: false, message: 'Sender user not found.' });
        }
        
        // 2. पर्याप्त डायमंड्स हैं या नहीं
        if (sender.diamonds < amount) {
            return res.status(403).json({ success: false, message: 'Insufficient diamonds.' });
        }

        // 3. लेन-देन (Transaction): डायमंड्स घटाएँ और Coins बढ़ाएँ
        sender.diamonds -= amount;
        
        // प्राप्तकर्ता (Receiver) के Coins को बढ़ाएँ (यह मानते हुए कि HostAnnie भी एक User है)
        let receiver = await User.findOne({ username: receiverId });

        if (receiver) {
            receiver.coins += amount; // Coins में जोड़ें
            await receiver.save();
        } 
        
        // 4. भेजने वाले का डेटाबेस अपडेट करें
        await sender.save();

        // Socket.io से सभी को उपहार (Gift) के बारे में बताएं (केवल सूचनात्मक)
        const io = req.app.get('socketio');
        // आप यह मान सकते हैं कि यह रूम 101 में है
        io.to('101').emit('gift_received', { 
            sender: senderUsername, 
            receiver: receiverId, 
            amount: amount 
        });


        // 5. सफलता का जवाब (Response)
        return res.json({ 
            success: true, 
            message: 'Gift sent successfully!', 
            newBalance: sender.diamonds 
        });

    } catch (error) {
        console.error('Gifting API Error:', error);
        res.status(500).json({ success: false, message: 'Server error during transaction.' });
    }
});

module.exports = router;
