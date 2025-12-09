const mongoose = require('mongoose');
const { User } = require('../models/User'); 

// --- Leveling Config (Phase 2) ---
const levelConfig = {
    "1": { "themeName": "Rookie Badge", "cssClass": "badge-gray" },
    "50": { "themeName": "Golden Star", "cssClass": "badge-gold" },
    "150": { "themeName": "Legendary God", "cssClass": "badge-legendary" }
};

function getLevelTheme(level) {
    if (level >= 150) return levelConfig["150"];
    if (level >= 50) return levelConfig["50"];
    return levelConfig["1"]; 
}

async function updateUserLevel(user) {
    const previousLevel = user.level;
    const newLevel = Math.floor(user.experiencePoints / 1000) + 1; 
    const finalLevel = newLevel > 150 ? 150 : newLevel;

    if (finalLevel > previousLevel) {
        user.level = finalLevel;
        return { levelUp: true, newLevel: finalLevel, theme: getLevelTheme(finalLevel) };
    }
    return { levelUp: false };
}

// --- Gifting Logic (Phase 2) ---
async function sendGift(senderId, receiverId, giftCostInDiamonds) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const sender = await User.findById(senderId).session(session);
        const receiver = await User.findById(receiverId).session(session);

        if (!sender || !receiver) throw new Error('User not found.');
        if (sender.diamonds < giftCostInDiamonds) throw new Error('Insufficient Diamonds');

        // Transaction
        sender.diamonds -= giftCostInDiamonds;
        const coinsReceived = giftCostInDiamonds; 
        receiver.coins += coinsReceived;
        
        // XP Update
        sender.experiencePoints += giftCostInDiamonds; 
        receiver.experiencePoints += (coinsReceived * 0.5); 

        await sender.save({ session });
        await receiver.save({ session });
        
        await updateUserLevel(receiver); // Leveling Check

        await session.commitTransaction();
        session.endSession();

        return { success: true, message: 'Gift sent successfully.' };

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        return { success: false, message: error.message };
    }
}

module.exports = {
    sendGift,
    updateUserLevel
};
                        
