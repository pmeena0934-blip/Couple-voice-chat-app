// public/scripts/ui.js

// utility function to find required XP for a level (must match backend's levelCalculator.js)
const XP_BASE = 100; 
const XP_MULTIPLIER = 1.2; 

function getRequiredXPForLevel(level) {
    if (level <= 1) return XP_BASE;
    // Calculate required XP: XP_BASE * (XP_MULTIPLIER ^ (level - 1))
    return Math.floor(XP_BASE * Math.pow(XP_MULTIPLIER, level - 1));
}

/**
 * अपडेट्स the level badge and XP bar for a user seat.
 * @param {string} seatId - The ID of the seat (e.g., 'host-seat')
 * @param {number} level - Current user level
 * @param {number} currentXP - Current experience points
 */
function updateLevelUI(seatId, level, currentXP) {
    const seat = document.getElementById(seatId);
    if (!seat) return;

    const levelBadge = seat.querySelector('.level-badge');
    const xpBar = seat.querySelector('.xp-bar');

    // 1. Level Badge Update
    if (levelBadge) {
        levelBadge.textContent = `LV ${level}`;
        // Level-based theme change (जैसे 50+ पर गोल्ड/फायर फ्रेम, 100+ पर डायमंड)
        if (level >= 100) {
            seat.querySelector('.avatar-container').style.borderColor = 'gold'; 
            // In a real app, this would change the background gradient/box-shadow based on level.
        }
    }

    // 2. XP Bar Update
    if (xpBar) {
        const requiredXPForCurrentLevel = getRequiredXPForLevel(level);
        const requiredXPForPrevLevel = level > 1 ? getRequiredXPForLevel(level - 1) : 0;
        
        // XP calculation: XP needed for the current level progress
        const xpProgress = currentXP - requiredXPForPrevLevel;
        const totalXPNeeded = requiredXPForCurrentLevel - requiredXPForPrevLevel;
        
        let percentage = (xpProgress / totalXPNeeded) * 100;
        
        // Handle max level 150
        if (level >= 150) {
            percentage = 100;
            if (levelBadge) levelBadge.textContent = `LV ${level} (MAX)`;
        }
        
        xpBar.style.width = `${percentage.toFixed(2)}%`;
    }
}


// --- Socket.io Event Listeners (Must be called after socket initialization in index.html) ---

window.setupSocketListeners = function(socket) {
    
    // Server से नया यूज़र आने का संकेत प्राप्त करें (WebRTC सिग्नलिंग भी शुरू होगी)
    socket.on('user_joined', ({ userId, count }) => {
        console.log(`User ${userId} joined. Total users: ${count}`);
        // ToDo: यहाँ यूज़र को खाली सीट पर जोड़ने का लॉजिक आएगा
    });
    
    // Server से गिफ्ट प्राप्त करने का संकेत (Real-time update)
    socket.on('gift_received', (data) => {
        const notificationArea = document.getElementById('notification-area');
        const msg = `🎁 ${data.sender} sent ${data.amount} Diamonds to ${data.receiver}!`;
        
        const notification = document.createElement('div');
        notification.textContent = msg;
        notificationArea.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
        
        console.log(`Gift received. Leveled up: ${data.leveledUp}`);

        // यदि प्राप्तकर्ता (Receiver) Host Annie है (सिर्फ़ डेमो के लिए)
        if (data.receiver === 'HostAnnie') {
             // ToDo: Real data should be fetched here, this is placeholder:
             const dummyXP = 100; // Assuming we don't know the exact XP from the socket data currently
             updateLevelUI('host-seat', data.newReceiverLevel, dummyXP); 
        }
    });
    
    // ToDo: add 'user_left' and other socket handlers here
};

// Start the initial UI update when the app loads (dummy data)
document.addEventListener('DOMContentLoaded', () => {
    // Demo: Host Annie
    updateLevelUI('host-seat', 1, 50); // Start at level 1, 50 XP
});
            
