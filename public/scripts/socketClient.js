// public/scripts/socketClient.js
const localVideo = document.createElement('video');
localVideo.autoplay = true;
localVideo.muted = true; // अपनी आवाज को म्यूट रखें

let peerConnection;
let localStream;
const remoteConnections = {}; // अन्य यूज़र्स के कनेक्शन

// WebRTC STUN/TURN सर्वर कॉन्फ़िगरेशन
const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }, // Google STUN server
    ]
};

// --- Media Stream (माइक्रोफ़ोन एक्सेस) ---
async function startLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        // इस स्ट्रीम को PeerConnection में जोड़ा जाएगा
        console.log("Local audio stream started.");
    } catch (error) {
        console.error("Error accessing microphone:", error);
    }
}

// --- Peer Connection बनाना और ऑफ़र/उत्तर भेजना ---
function createPeerConnection(remoteSocketId) {
    peerConnection = new RTCPeerConnection(iceServers);
    remoteConnections[remoteSocketId] = peerConnection;

    // 1. लोकल स्ट्रीम ट्रैक जोड़ें
    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }

    // 2. ICE कैंडिडेट्स को संभालना (नेटवर्क जानकारी)
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            // ICE कैंडिडेट को दूसरे यूज़र को भेजें
            socket.emit('webrtc_ice_candidate', {
                target: remoteSocketId,
                candidate: event.candidate
            });
        }
    };

    // 3. रिमोट ट्रैक प्राप्त करना (दूसरे यूज़र की आवाज़)
    peerConnection.ontrack = event => {
        const audio = new Audio();
        audio.autoplay = true;
        audio.srcObject = event.streams[0];
        // Note: यहाँ आपको इस ऑडियो को सही सीट (Host/Co-host) से मैप करना होगा
        console.log("Received remote audio stream.");
    };

    return peerConnection;
}

// Socket.io कनेक्शन Logic (यह index.html में है)
// यह सुनिश्चित करता है कि जब भी कोई नया यूज़र रूम में आता है, हम उसके साथ कनेक्शन शुरू करते हैं
if (typeof socket !== 'undefined') {
    socket.on('user_joined', ({ userId, count }) => {
        console.log(`User ${userId} joined. Total users: ${count}`);

        // यदि हम पहले से ही रूम में हैं, तो नए यूज़र के लिए WebRTC कनेक्शन शुरू करें
        // यहाँ जटिलता है क्योंकि एक 15-सीट रूम में, आपको सभी के साथ कनेक्शन नहीं बनाना पड़ता।
        // सादगी के लिए, हम मानते हैं कि होस्ट ही सबसे पहले कनेक्शन बनाता है।
        // For simplicity: If this is a Host-Client model, only the host initiates.
    });
}


// यह फ़ंक्शन index.html में handleLogin() के सफल होने के बाद कॉल किया जाता है।
window.initVoiceChat = async () => {
    await startLocalStream();
    // यदि आप Host हैं, तो आप रूम में अन्य सभी को कॉल करना शुरू कर सकते हैं।
};
        
