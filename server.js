// server.js (Complete File - UPDATED with UPI Payment Logic)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// --- Import Models ---
const User = require('./models/User');
const Transaction = require('./models/Transaction'); // New Transaction Model

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

// ********** PROFILE AND ROOM EDIT API **********
app.post('/api/profile/edit', async (req, res) => {
    const { username, newUsername, newRoomName, newProfilePicUrl } = req.body;

    try {
        let user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        
        let updateFields = {};
        
        if (newUsername && newUsername !== user.username) {
            const existingUser = await User.findOne({ username: newUsername });
            if (existingUser) {
                return res.status(400).json({ success: false, message: 'New username already taken.' });
            }
            updateFields.username = newUsername;
        }

        if (newProfilePicUrl) {
            updateFields.profilePic = newProfilePicUrl; 
        }

        if (newRoomName) {
            updateFields.roomName = newRoomName; 
        }
        
        const updatedUser = await User.findOneAndUpdate({ username }, { $set: updateFields }, { new: true });

        return res.json({ success: true, message: 'Profile updated successfully!', user: updatedUser });

    } catch (error) {
        console.error('Profile Edit Error:', error);
        res.status(500).json({ success: false, message: 'Server error during profile update.' });
    }
});
// ***********************************************

// ********** DIAMOND PURCHASE API (User Submission - NEW) **********
app.post('/api/buy-diamonds', async (req, res) => {
    // Note: Payment package is 500 Diamonds for 200 Rs (Hardcoded for demo)
    const { username, utrNumber, screenshotUrl } = req.body;
    const diamondAmount = 500;
    const fiatAmount = 200;

    if (!username || !utrNumber || !screenshotUrl) {
        return res.status(400).json({ success: false, message: 'Username, UTR, and Screenshot URL are required.' });
    }

    try {
        // Check if UTR number is already in process
        const existingTransaction = await Transaction.findOne({ utrNumber });
        if (existingTransaction) {
            return res.status(400).json({ success: false, message: 'This UTR number is already recorded.' });
        }

        const newTransaction = new Transaction({
            username,
            diamondAmount,
            fiatAmount,
            utrNumber,
            screenshotUrl,
            status: 'Pending'
        });

        await newTransaction.save();
        
        // Admin को सूचित करने का लॉजिक यहाँ आएगा (Socket.io या ईमेल)

        res.json({ success: true, message: 'Payment request submitted successfully. Diamonds will be credited after verification.' });

    } catch (error) {
        console.error('Diamond Purchase Error:', error);
        res.status(500).json({ success: false, message: 'Server error during transaction submission.' });
    }
});
// *************************************************************

// ********** ADMIN APPROVAL API (Manual Logic - NEW) **********
// Note: This needs an external admin dashboard or a separate secure UI for you (the owner)
app.post('/api/admin/approve-payment', async (req, res) => {
    // AdminId यहाँ सुरक्षा के लिए होना चाहिए, लेकिन अभी के लिए सरलता के लिए छोड़ा गया है
    const { transactionId, status } = req.body; 

    if (!transactionId || !['Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid approval details or status.' });
    }

    try {
        const transaction = await Transaction.findById(transactionId);

        if (!transaction || transaction.status !== 'Pending') {
            return res.status(404).json({ success: false, message: 'Transaction not found or already processed.' });
        }

        transaction.status = status;
        transaction.approvedBy = 'OwnerID'; // Replace with actual Admin/Owner ID later
        await transaction.save();

        if (status === 'Approved') {
            const user = await User.findOne({ username: transaction.username });

            if (user) {
                user.diamonds += transaction.diamondAmount;
                await user.save();
                
                // Front-end को सूचित करें कि डायमंड्स क्रेडिट हो गए हैं
                //io.to(user.socketId).emit('diamonds_credited', { amount: transaction.diamondAmount, newBalance: user.diamonds });
                
                res.json({ success: true, message: `Payment approved. ${transaction.diamondAmount} Diamonds credited to ${user.username}.` });
                return;
            }
        }

        res.json({ success: true, message: `Payment ${status.toLowerCase()} successful.` });

    } catch (error) {
        console.error('Admin Approval Error:', error);
        res.status(500).json({ success: false, message: 'Server error during approval process.' });
    }
});
// *************************************************************


// --- HOMEPAGE ROUTE (index.html) ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
// ------------------------------------

// ********** Global Map to track user's room and ID (Socket.io) **********
const userRoomMap = {};
// ************************************************************************

// --- Socket.io Logic ---
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    
    socket.on('join_room', ({ roomId, userId }) => {
        socket.join(roomId);
        userRoomMap[socket.id] = { roomId, userId };
        
        console.log(`${userId} joined room ${roomId}`);

        const currentRoom = io.sockets.adapter.rooms.get(roomId);
        const count = currentRoom ? currentRoom.size : 1;
        io.to(roomId).emit('user_joined', { userId, count });

        if(currentRoom) {
            const otherUsers = Array.from(currentRoom).filter(id => id !== socket.id);
            socket.emit('all_other_users', { users: otherUsers }); 
        }
    });

    // WebRTC Signaling: OFFER, ANSWER, ICE CANDIDATE
    socket.on('webrtc_offer', (data) => {
        io.to(data.target).emit('webrtc_offer', { sender: socket.id, offer: data.offer });
    });
    socket.on('webrtc_answer', (data) => {
        io.to(data.target).emit('webrtc_answer', { sender: socket.id, answer: data.answer });
    });
    socket.on('webrtc_ice_candidate', (data) => {
        io.to(data.target).emit('webrtc_ice_candidate', { sender: socket.id, candidate: data.candidate });
    });
    
    // Gift sending notification
    socket.on('send_gift_realtime', (data) => {
        io.to(data.roomId).emit('gift_received_animation', data);
    });

    // Disconnect handling
    socket.on('disconnect', () => {
        const roomInfo = userRoomMap[socket.id];
        if (roomInfo) {
            io.to(roomInfo.roomId).emit('user_left', { userId: roomInfo.userId });
            delete userRoomMap[socket.id];
        }
        console.log('User disconnected:', socket.id);
    });
});


const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}. Frontend available`));
