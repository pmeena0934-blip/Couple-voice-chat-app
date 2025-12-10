// public/scripts/socketClient.js (WebRTC & Socket.io Logic)

// सुनिश्चित करें कि 'socket' वेरिएबल index.html से उपलब्ध है
const socket = window.socket; 

let localStream;
const remoteConnections = {}; // Key: remoteSocketId, Value: RTCPeerConnection object
const remoteAudioElements = {}; // Key: remoteSocketId, Value: Audio element

const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// --- 1. Local Media Stream ---
async function startLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        console.log("Local audio stream started.");
        
        // Host की सीट पर माइक्रोफ़ोन को एक्टिवेट करें
        const micIcon = document.querySelector('#host-seat .mic-icon');
        if (micIcon) {
            micIcon.classList.add('active');
        }
        
    } catch (error) {
        console.error("Error accessing microphone:", error);
    }
}

// --- 2. Peer Connection Logic ---
function createPeerConnection(remoteSocketId, isRequester) {
    const peerConnection = new RTCPeerConnection(iceServers);
    remoteConnections[remoteSocketId] = peerConnection;

    // A. Local Stream Track जोड़ें
    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }

    // B. ICE Candidates को संभालना
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('webrtc_ice_candidate', {
                target: remoteSocketId,
                candidate: event.candidate
            });
        }
    };

    // C. Remote Track प्राप्त करना
    peerConnection.ontrack = event => {
        if (event.streams && event.streams[0]) {
            let audio = remoteAudioElements[remoteSocketId];
            if (!audio) {
                audio = new Audio();
                audio.autoplay = true;
                remoteAudioElements[remoteSocketId] = audio;
                // इस ऑडियो को UI में किसी सीट से जोड़ना होगा (अभी के लिए hidden)
                document.body.appendChild(audio);
            }
            audio.srcObject = event.streams[0];
            console.log(`Received stream from ${remoteSocketId}`);
        }
    };
    
    // D. यदि हम कॉल करने वाले हैं, तो ऑफर बनाएँ
    if (isRequester) {
        peerConnection.createOffer()
            .then(offer => peerConnection.setLocalDescription(offer))
            .then(() => {
                socket.emit('webrtc_offer', {
                    target: remoteSocketId,
                    offer: peerConnection.localDescription
                });
            })
            .catch(error => console.error("Error creating offer:", error));
    }
    
    return peerConnection;
}

// --- 3. Socket.io Handlers ---

// a) Room में मौजूद बाकी यूज़र्स से कनेक्शन शुरू करें (जब हम पहली बार रूम में आते हैं)
socket.on('all_other_users', ({ users }) => {
    users.forEach(userId => {
        createPeerConnection(userId, true); // true = हम कॉल शुरू कर रहे हैं
    });
});

// b) नया ऑफर प्राप्त करें (कोई हमें कॉल कर रहा है)
socket.on('webrtc_offer', (data) => {
    const peerConnection = createPeerConnection(data.sender, false); // false = हम कॉल रिसीव कर रहे हैं

    peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
        .then(() => peerConnection.createAnswer())
        .then(answer => peerConnection.setLocalDescription(answer))
        .then(() => {
            socket.emit('webrtc_answer', {
                target: data.sender,
                answer: peerConnection.localDescription
            });
        })
        .catch(error => console.error("Error creating answer:", error));
});

// c) ANSWER प्राप्त करें (हमारे ऑफर का जवाब)
socket.on('webrtc_answer', (data) => {
    const pc = remoteConnections[data.sender];
    if (pc) {
        pc.setRemoteDescription(new RTCSessionDescription(data.answer))
            .catch(error => console.error("Error setting remote answer:", error));
    }
});

// d) ICE CANDIDATE प्राप्त करें
socket.on('webrtc_ice_candidate', (data) => {
    const pc = remoteConnections[data.sender];
    if (pc && data.candidate) {
        pc.addIceCandidate(new RTCIceCandidate(data.candidate))
            .catch(error => console.error("Error adding ICE candidate:", error));
    }
});


// --- Initialization Function (Called from index.html after successful login) ---
window.initVoiceChat = async () => {
    if (!localStream) {
        await startLocalStream();
    }
    // Room में मौजूद यूज़र्स के साथ कनेक्शन शुरू करने का काम Socket.io handlers संभालेंगे
};

// --- Gifting Real-time Logic (Animation) ---
socket.on('gift_received_animation', (data) => {
    const notificationArea = document.getElementById('notification-area');
    const msg = `${data.sender} sent a gift of ${data.amount} Diamonds to ${data.receiver}! Level up: ${data.leveledUp ? 'YES' : 'No'}`;
    
    // यहाँ आप GIF Animation चला सकते हैं
    const giftAnimation = document.getElementById('gift-animation-container');
    if(giftAnimation) {
        giftAnimation.textContent = `*** GRAND GIFT ANIMATION: ${data.amount} ***`;
        setTimeout(() => giftAnimation.textContent = '', 3000); // 3 सेकंड बाद हटा दें
    }

    const notification = document.createElement('div');
    notification.textContent = msg;
    notificationArea.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
});
            
