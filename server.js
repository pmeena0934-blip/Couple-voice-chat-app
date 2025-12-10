// server.js (Complete File - Updated with Profile Edit API)
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
const MONGODB_URI = 'mongodb+srv://Meena7800:Meena9090@cluster0.c2utkn0.mongodb.net/couple-voice-chat-app?retryWrites=true&w=majority&appName=Cluster0';

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
            // New user, create and give 500 diamonds (Default from User model)
            user = new User({ username });
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

// ********** PROFILE AND ROOM EDIT API (New Addition) **********
app.post('/api/profile/edit', async (req, res) => {
    const { username, newUsername, newRoomName, newProfilePicUrl } = req.body;

    try {
        let user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        
        let updateFields = {};
        
        // Update username if provided
        if (newUsername && newUsername !== user.username) {
            const existingUser = await User.findOne({ username: newUsername });
            if (existingUser) {
                return res.status(400).json({ success: false, message: 'New username already taken.' });
            }
            updateFields.username = newUsername;
        }

        // Update profile picture URL
        if (newProfilePicUrl) {
            updateFields.profilePic = newProfilePicUrl; 
        }

        // Update room name
        if (newRoomName) {
            updateFields.roomName = newRoomName; 
        }
        
        const updatedUser = await User.findOneAndUpdate({ username }, { $set: updateFields }, { new: true });

        // Update localStorage data if username was changed
        const newUserData = { 
            ...updatedUser.toObject(), 
            // In a real app, you'd send a socket update to clients 
        };

        return res.json({ success: true, message: 'Profile updated successfully!', user: newUserData });

    } catch (error) {
        console.error('Profile Edit Error:', error);
        res.status(500).json({ success: false, message: 'Server error during profile update.' });
    }
});
// ***********************************************


// --- HOMEPAGE ROUTE (index.html) ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
// ------------------------------------

// ********** Global Map to track user's room and ID (Socket.io) **********
const userRoomMap = {};
// ************************************************************************

// --- Socket.io Logic (UPDATED) ---
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    
    // जब कोई यूज़र किसी रूम में शामिल होता है
    socket.on('join_room', ({ roomId, userId }) => {
        socket.join(roomId);
        userRoomMap[socket.id] = { roomId, userId };
        
        console.log(`${userId} joined room ${roomId}`);

        // उस रूम के सभी क्लाइंट को सूचित करें कि एक नया यूज़र आया है
        const currentRoom = io.sockets.adapter.rooms.get(roomId);
        const count = currentRoom ? currentRoom.size : 1;
        io.to(roomId).emit('user_joined', { userId, count });

        // रूम में मौजूद बाकी सभी यूज़र्स को संकेत भेजें (WebRTC के लिए)
        if(currentRoom) {
            const otherUsers = Array.from(currentRoom).filter(id => id !== socket.id);
            socket.emit('all_other_users', { users: otherUsers }); // केवल नए यूज़र को बाकी की सूची भेजें
        }
    });

    // WebRTC सिग्नलिंग: 1. OFFER
    socket.on('webrtc_offer', (data) => {
        io.to(data.target).emit('webrtc_offer', {
            sender: socket.id,
            offer: data.offer
        });
    });

    // WebRTC सिग्नलिंग: 2. ANSWER
    socket.on('webrtc_answer', (data) => {
        io.to(data.target).emit('webrtc_answer', {
            sender: socket.id,
            answer: data.answer
        });
    });

    // WebRTC सिग्नलिंग: 3. ICE CANDIDATE
    socket.on('webrtc_ice_candidate', (data) => {
        io.to(data.target).emit('webrtc_ice_candidate', {
            sender: socket.id,
            candidate: data.candidate
        });
    });
    
    // गिफ्ट भेजने पर सभी को सूचित करें
    socket.on('send_gift_realtime', (data) => {
        io.to(data.roomId).emit('gift_received_animation', data);
    });


    // जब यूज़र डिस्कनेक्ट होता है
    socket.on('disconnect', () => {
        const roomInfo = userRoomMap[socket.id];
        if (roomInfo) {
            io.to(roomInfo.roomId).emit('user_left', { userId: roomInfo.userId });
            delete userRoomMap[socket.id];
        }
        console.log('User disconnected:', socket.id);
    });
});
// --- End of Socket.io Logic ---


const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}. Frontend available`));
