// server.js (Updated with MongoDB Atlas)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

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
const MONGODB_URI = 'mongodb+srv://Meena7800:Meena9090@cluster0.c2utkn0.mongodb.net/couple-voice-chat?appName=Cluster0';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB Atlas Connected'))
  .catch(err => {
    console.error('MongoDB Atlas Connection Error:');
    console.error(err);
  });

// --- API Routes ---
app.use('/api/wallet', walletRoutes);

// --- Socket.io Logic ---
io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);

  // Room Joining (Phase 1)
  socket.on('join_room', async ({ roomId, userId }) => {
    socket.join(roomId);
    io.to(roomId).emit('user_joined', { userId, count: io.sockets.adapter.rooms.get(roomId)?.size || 0 });
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
server.listen(PORT, () => console.log(`Server running on port ${PORT}. Frontend available on http://localhost:${PORT}`));
                                       
