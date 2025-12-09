// scripts/socketClient.js
const socket = io('http://localhost:5000'); 

// --- Utility Functions (Phase 4) ---
function triggerGiftAnimation(giftClass) {
    const container = document.getElementById('gift-animation-container');
    const giftElement = document.createElement('div');
    giftElement.className = `flying-gift ${giftClass}`;
    // Randomize start position
    giftElement.style.left = `${Math.random() * 80 + 10}%`; 
    container.appendChild(giftElement);
    
    setTimeout(() => {
        giftElement.remove();
    }, 3000);
}

// --- Socket Listeners ---
socket.on('connect', () => {
    console.log("Connected to Server!");
    
    // Phase 1: Room Join
    socket.emit('join_room', { roomId: ROOM_ID, userId: SENDER_ID });
});

socket.on('user_joined', (data) => {
    console.log(`${data.userId} joined the room. Total: ${data.count}`);
    // आप यहाँ VIP Check कर सकते हैं और showVipEntry() को कॉल कर सकते हैं
});

// Phase 4: Gifting Animation Trigger
socket.on('gift_notification', (data) => {
    console.log(`Socket Event: Gift received from ${data.senderId}: ${data.giftType}`);
    
    // Animation trigger
    const giftClass = data.giftType === 'rocket' ? 'gift-rocket' : 'gift-rose';
    triggerGiftAnimation(giftClass);

    // TODO: UI में Coin/Diamond बैलेंस अपडेट करें।
});

// Phase 1: WebRTC listeners (ये सिर्फ़ प्लेसहोल्डर हैं)
socket.on('webrtc_offer', (payload) => { console.log('Received WebRTC Offer'); });
socket.on('webrtc_answer', (payload) => { console.log('Received WebRTC Answer'); });
socket.on('ice_candidate', (payload) => { console.log('Received ICE Candidate'); });
