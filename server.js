// server.js (Complete File - UPDATED with PWA & Entry Effect Gift Data)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// --- Import Models ---
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const Gift = require('./models/Gift'); 
const Room = require('./models/Room'); 

// --- Import Routes ---
const walletRoutes = require('./routes/wallet');

// --- Initial Gift Data Setup Function (UPDATED) ---
async function setupInitialGifts() {
    const defaultGifts = [
        { name: 'Rose', diamondCost: 10, category: 'Small', imageUrl: 'images/rose.png' },
        { name: 'Teddy Bear', diamondCost: 100, category: 'Medium', imageUrl: 'images/teddy.png' },
        { name: 'Luxury Car', diamondCost: 10000, category: 'Car', imageUrl: 'images/car.png' },
        { name: 'Super Rocket', diamondCost: 50000, category: 'SuperGift', imageUrl: 'images/rocket.png', isSuperGift: true },
        // 10,00,000 Diamond Gift with CAR entry effect (NEW LOGIC ADDED)
        { name: 'Golden Dragon', diamondCost: 1000000, category: 'SuperGift', imageUrl: 'images/dragon.png', isSuperGift: true, entryEffect: 'car' }, 
        { name: 'Entrance Frame', diamondCost: 500, category: 'EntryEffect', imageUrl: 'images/frame.png' }
    ];

    for (const gift of defaultGifts) {
        // Only insert/update if it doesn't exist/needs update
        await Gift.updateOne({ name: gift.name }, gift, { upsert: true });
    }
    console.log('Default gifts ensured in database.');
}

// --- App Setup ---
const app = express();
app.use(cors());
app.use(express.json());
// Serve static files from the 'public' directory
app.use(express.static('public')); 

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.set('socketio', io);

// --- Database Connection ---
const MONGODB_URI = 'mongodb+srv://Meena7800:Meena9090@cluster0.c2utkn0.mongodb.net/couple-voice-chat-app?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB Atlas Connected');
    setupInitialGifts(); // Initialize gifts after connection
  })
  .catch(err => {
    console.error('MongoDB Atlas Connection Error:', err);
  });

// --- API Routes ---
app.use('/api/wallet', walletRoutes);


// ********** LOGIN API ROUTE **********
app.post('/api/login', async (req, res) => {
    const { username } = req.body;

    try {
        let user = await User.findOne({ username });

        if (!user) {
            user = new User({ username });
            await user.save();
            return res.json({ success: true, message: 'Registration successful!', user });
        } else {
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
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
        let updateFields = {};
        
        if (newUsername && newUsername !== user.username) {
            const existingUser = await User.findOne({ username: newUsername });
            if (existingUser) return res.status(400).json({ success: false, message: 'New username already taken.' });
            updateFields.username = newUsername;
        }
        if (newProfilePicUrl) updateFields.profilePic = newProfilePicUrl; 
        if (newRoomName) updateFields.roomName = newRoomName; 
        
        const updatedUser = await User.findOneAndUpdate({ username }, { $set: updateFields }, { new: true });
        // Also update the Room name if this user owns a room
        await Room.updateOne({ ownerUsername: username }, { name: updatedUser.roomName });

        return res.json({ success: true, message: 'Profile updated successfully!', user: updatedUser });

    } catch (error) {
        console.error('Profile Edit Error:', error);
        res.status(500).json({ success: false, message: 'Server error during profile update.' });
    }
});
// ***********************************************

// ********** DIAMOND PURCHASE API (User Submission) **********
app.post('/api/buy-diamonds', async (req, res) => {
    const { username, utrNumber, screenshotUrl } = req.body;
    const diamondAmount = 500;
    const fiatAmount = 200;
    
    if (!username || !utrNumber || !screenshotUrl) return res.status(400).json({ success: false, message: 'Required fields missing.' });

    try {
        const existingTransaction = await Transaction.findOne({ utrNumber });
        if (existingTransaction) return res.status(400).json({ success: false, message: 'This UTR number is already recorded.' });

        const newTransaction = new Transaction({ username, diamondAmount, fiatAmount, utrNumber, screenshotUrl });
        await newTransaction.save();
        
        res.json({ success: true, message: 'Payment request submitted successfully. Diamonds will be credited after verification.' });

    } catch (error) {
        console.error('Diamond Purchase Error:', error);
        res.status(500).json({ success: false, message: 'Server error during transaction submission.' });
    }
});
// *************************************************************

// ********** ADMIN APPROVAL API (Manual Logic) **********
app.post('/api/admin/approve-payment', async (req, res) => {
    const { transactionId, status } = req.body; 
    
    if (!transactionId || !['Approved', 'Rejected'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid approval details or status.' });

    try {
        const transaction = await Transaction.findById(transactionId);
        if (!transaction || transaction.status !== 'Pending') return res.status(404).json({ success: false, message: 'Transaction not found or already processed.' });

        transaction.status = status;
        transaction.approvedBy = 'OwnerID'; 
        await transaction.save();

        if (status === 'Approved') {
            const user = await User.findOne({ username: transaction.username });
            if (user) {
                user.diamonds += transaction.diamondAmount;
                await user.save();
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

// ********** GET GIFTS API (For Frontend Store) **********
app.get('/api/gifts', async (req, res) => {
    try {
        const gifts = await Gift.find({});
        res.json({ success: true, gifts });
    } catch (error) {
        console.error('Get Gifts Error:', error);
        res.status(500).json({ success: false, message: 'Could not fetch gifts.' });
    }
});
// *********************************************************

// ********** VIP ROOM CREATION API **********
app.post('/api/room/create', async (req, res) => {
    const { username, roomName, isVIP } = req.body;
    const VIP_COST_DIAMONDS = 200; 

    try {
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        // Check if user already owns a room
        const existingRoom = await Room.findOne({ ownerUsername: username });
        if (existingRoom) {
            return res.status(400).json({ success: false, message: `You already own room: ${existingRoom.name}.` });
        }
        
        let newRoomData = {
            name: roomName,
            ownerUsername: username,
            roomId: Date.now().toString().slice(-5), 
            isVIP: false
        };

        if (isVIP) {
            if (user.diamonds < VIP_COST_DIAMONDS) {
                return res.status(400).json({ success: false, message: `Insufficient diamonds. Requires ${VIP_COST_DIAMONDS} diamonds for VIP room.` });
            }
            
            // Deduct diamonds for VIP room
            user.diamonds -= VIP_COST_DIAMONDS;
            await user.save();
            
            // Set VIP status (e.g., for 30 days)
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30); 
            
            newRoomData.isVIP = true;
            newRoomData.vipExpiry = expiryDate;
        }

        const newRoom = new Room(newRoomData);
        await newRoom.save();

        res.json({ 
            success: true, 
            message: `Room "${newRoom.name}" created successfully. ${isVIP ? 'VIP status applied.' : ''}`, 
            room: newRoom,
            newDiamondBalance: user.diamonds 
        });

    } catch (error) {
        console.error('Room Creation Error:', error);
        res.status(500).json({ success: false, message: 'Server error during room creation.' });
    }
});
// *************************************************

// --- HOMEPAGE ROUTE (index.html) and PWA Static Assets ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// If using a separate /public folder (as suggested), these are already served by express.static('public')
// app.get('/manifest.json', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'manifest.json')); });
// app.get('/sw.js', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'sw.js')); });

// *************************************

// ********** Global Map to track user's room and ID (Socket.io) **********
const userRoomMap = {};
// ************************************************************************

// --- Socket.io Logic (UPDATED for Super Gifts & Entry Effects) ---
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    
    socket.on('join_room', ({ roomId, userId }) => {
        socket.join(roomId);
        userRoomMap[socket.id] = { roomId, userId };
        
        const currentRoom = io.sockets.adapter.rooms.get(roomId);
        const count = currentRoom ? currentRoom.size : 1;
        io.to(roomId).emit('user_joined', { userId, count });

        if(currentRoom) {
            const otherUsers = Array.from(currentRoom).filter(id => id !== socket.id);
            socket.emit('all_other_users', { users: otherUsers }); 
        }
    });

    // Gift sending notification (Super Gift announcement added)
    socket.on('send_gift_realtime', (data) => {
        // Send to the room for local animation (gift_received_animation handles entryEffect logic on client)
        io.to(data.roomId).emit('gift_received_animation', data);
        
        // --- SUPER GIFT ANNOUNCEMENT ---
        if (data.isSuperGift) {
            // Send global announcement for gifts (like 50,000+ diamond gifts)
            io.emit('global_announcement', {
                message: `${data.sender} sent a **${data.giftName} (${data.amount} Diamonds)** to ${data.receiver} in Room ${data.roomId}! 🚀`,
                type: 'SuperGift'
            });
        }
    });

    // WebRTC Signaling: OFFER, ANSWER, ICE CANDIDATE
    socket.on('webrtc_offer', (data) => { io.to(data.target).emit('webrtc_offer', { sender: socket.id, offer: data.offer }); });
    socket.on('webrtc_answer', (data) => { io.to(data.target).emit('webrtc_answer', { sender: socket.id, answer: data.answer }); });
    socket.on('webrtc_ice_candidate', (data) => { io.to(data.target).emit('webrtc_ice_candidate', { sender: socket.id, candidate: data.candidate }); });
    
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
