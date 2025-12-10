// utils/levelCalculator.js

const XP_BASE = 100; // Level 1 से Level 2 तक जाने के लिए 100 XP
const XP_MULTIPLIER = 1.2; // हर अगले लेवल के लिए XP की आवश्यकता 20% बढ़ जाती है

// किसी विशेष लेवल पर पहुंचने के लिए कुल XP की आवश्यकता की गणना करता है
function getRequiredXPForLevel(level) {
    if (level <= 1) return XP_BASE;
    // आवश्यक XP = XP_BASE * (XP_MULTIPLIER ^ (level - 1))
    return Math.floor(XP_BASE * Math.pow(XP_MULTIPLIER, level - 1));
}

// यह फ़ंक्शन जांचता है कि यूज़र को लेवल अप करने की आवश्यकता है या नहीं
function checkLevelUp(user) {
    let leveledUp = false;
    let requiredXP = getRequiredXPForLevel(user.level);

    while (user.experiencePoints >= requiredXP) {
        // Level Up!
        user.level += 1;
        user.experiencePoints -= requiredXP; // शेष XP को अगले लेवल के लिए रखें
        leveledUp = true;
        
        // अगले लेवल के लिए XP की आवश्यकता अपडेट करें
        requiredXP = getRequiredXPForLevel(user.level);

        if (user.level >= 150) {
             user.level = 150; // अधिकतम सीमा
             break;
        }
    }
    return leveledUp;
}

module.exports = {
    getRequiredXPForLevel,
    checkLevelUp
};
  
