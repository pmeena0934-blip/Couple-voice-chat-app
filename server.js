// server.js (FINAL VERSION with Login Route and Homepage serving)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const User = require('./models/User');

// --- Import Routes ---
const walletRoutes = require('./routes/wallet');

// --- App Setup ---
const app = express();
app.use(cors());
app.use(express.json());

// पब्लिक फ़ोल्डर को स्टैटिकली सर्व करें
app.use(express.static('public'));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// Socket.io इंस्टेंस को routes से access करने के लिए सेट करें
app.set('socketio', io);

// --- Database Connection ---
// ********** MONGODB_URI यहाँ ठीक कर दिया गया है **********
const MONGODB_URI = 'mongodb+srv://Meena7800:Meena9090@cluster0.c2utkn0.mongodb.net/couple-voice-chat-app';
// ********************************************************

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB Atlas Connected'))
  .catch(err => {
    console.error('MongoDB Atlas Connection Error:');
    console.error(err);
  });

// --- API Routes ---
app.use('/api/wallet', walletRoutes);

// ********** LOGIN API ROUTE **********
app.post('/api/login', async (req, res) => {
    const { username } = req.body;

    try {
        let user = await User.findOne({ username });

        if (!user) {
            // New user, create and give 1000 diamonds
            user = new User({ username, diamonds: 1000 });
            await user.save();
            return res.json({ success: true, message: 'Registration successful!', user });
        } else {
            // Existing user
            return res.json({ success: true, message: 'Login successful!', user });
        }
    } catch (error) {
        console.error('Login/Registration Error:', error);
        res.status(500).json({ success: false, message: 'Server error during authentication.' });
    }
});
// *************************************


// --- HOMEPAGE ROUTE (index.html) ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
// ------------------------------------


// --- Socket.io Logic ---
io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);

  // Room Joining (Phase 1)
  socket.on('join_room', async ({ roomId, userId }) => {
    socket.join(roomId);
    io.to(roomId).emit('user_joined', { userId, count: io.sockets.adapter.rooms.get(roomId).size });
  });

  // WebRTC Signaling (Phase 1)
  socket.on('webrtc_offer', (payload) => {
    io.to(payload.target).emit('webrtc_offer', payload);
  });

  socket.on('webrtc_answer', (payload) => {
    io.to(payload.target).emit('webrtc_answer', payload);
  });

  // disconnect हैंडलिंग
  socket.on('disconnect', () => {
    console.log('User Disconnected');
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}. Frontend available`));
  
