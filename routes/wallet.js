const express = require('express');
const router = express.Router();
const { sendGift } = require('../controllers/giftingController'); 
const { User } = require('../models/User'); 

// DUMMY AUTH (Testing के लिए)
async function authenticateUser(req, res, next) {
    // Testing के लिए User ID DB में चेक करें
    const user = await User.findById(req.body.senderId || req.body.userId);
    if (!user) return res.status(401).json({ error: "User not authenticated or found." });
    req.user = user; 
    next();
}

// Phase 2 & 4: Send Gift API
router.post('/send-gift', authenticateUser, async (req, res) => {
    const { senderId, receiverId, giftCostInDiamonds, roomId } = req.body;
    
    const result = await sendGift(senderId, receiverId, giftCostInDiamonds);

    if (result.success) {
        // Socket.io Broadcast (Phase 4: Gifting Animation Trigger)
        const io = req.app.get('socketio');
        io.to(roomId).emit('gift_notification', {
            senderId,
            receiverId,
            cost: giftCostInDiamonds,
            giftType: giftCostInDiamonds >= 500 ? 'rocket' : 'rose' 
        });
        
        return res.status(200).json({ success: true, message: 'Gift sent and broadcasted.' });
    } else {
        return res.status(400).json({ success: false, error: result.message });
    }
});

// Phase 2: Dummy Buy Diamonds API
router.post('/buy-diamonds', authenticateUser, (req, res) => {
    // यह सिर्फ एक डमी है। असल में पेमेंट गेटवे से इंटीग्रेशन होगा।
    res.json({ success: true, message: "Payment intent created. Waiting for confirmation." });
});


module.exports = router;
  
