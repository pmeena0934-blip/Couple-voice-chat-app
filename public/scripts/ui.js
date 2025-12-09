// scripts/ui.js

// डमी यूजर/रूम डेटा (Backend से मिलेगा)
const ROOM_ID = "room_101";
const SENDER_ID = "6573c71a39d88b48866759c5"; // MongoDB ID format (Testing के लिए)
const RECEIVER_ID = "6573c71a39d88b48866759c6"; // Host ID (Testing के लिए)

// Phase 3: VIP Entry Animation Function
function showVipEntry(username, message) {
    const notificationArea = document.getElementById('notification-area');
    
    const div = document.createElement('div');
    div.className = 'vip-entry-card';
    div.innerHTML = `
        <span>👑 VIP ${username} ${message}</span>
    `;

    notificationArea.appendChild(div);

    setTimeout(() => {
        div.remove();
    }, 5000);
}

// Phase 4: Gifting Simulation (जब बटन दबाया जाता है)
function simulateGift(diamondCost) {
    // Note: React/Vue में यहाँ Axios या Fetch का उपयोग होगा
    
    console.log(`Sending gift of ${diamondCost} diamonds...`);
    
    // डमी API कॉल (आपको 'axios' या 'fetch' लाइब्रेरी का उपयोग करना होगा)
    fetch('/api/wallet/send-gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            senderId: SENDER_ID, // आपको DB में ये IDs बनाने होंगे
            receiverId: RECEIVER_ID,
            giftCostInDiamonds: diamondCost,
            roomId: ROOM_ID
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            console.log("Gift API Success. Check console for Socket.io broadcast.");
        } else {
            alert("Gifting Failed: " + data.error);
        }
    })
    .catch(err => console.error("API Error:", err));
}

// टेस्टिंग के लिए (जब पेज लोड हो)
// showVipEntry("Rohan Sharma", "has entered the chat!");
