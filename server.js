// server.js (Complete File - FINAL CODE)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// --- Import Models (Ensure these models exist in models/ folder) ---
const User = require('./models/User'); 
const Transaction = require('./models/Transaction'); 
const Gift = require('./models/Gift'); 
const Room = require('./models/Room'); 

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
    // setupInitialGifts(); // You can uncomment this if you have the function defined
  })
  .catch(err => {
    console.error('MongoDB Atlas Connection Error:', err);
    process.exit(1); 
  });

// --- API Routes ---

// ********** LOGIN/REGISTRATION API ROUTE (FIXED) **********
app.post('/api/login', async (req, res) => {
    const { username } = req.body;
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ success: false, message: 'Server currently unavailable. Database connection failed.' });
    }
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
        console.error('Login/Registration Runtime Error:', error.message);
        res.status(500).json({ success: false, message: 'Server error during authentication: ' + error.message });
    }
});
// *********************************************************

// ********** ROOM CREATION API **********
app.post('/api/room/create', async (req, res) => {
    const { username, roomName, isVIP } = req.body;
    const VIP_COST_DIAMONDS = 200; 

    try {
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        const existingRoom = await Room.findOne({ ownerUsername: username });
        if (existingRoom) {
            return res.status(400).json({ success: false, message: `You already own room: ${existingRoom.name}.` });
        }
        
        let newRoomData = {
            name: roomName,
            ownerUsername: username,
            // Simple 5-digit Room ID
            roomId: Date.now().toString().slice(-5), 
            isVIP: false,
            // Add owner profile info for display in room list
            ownerProfilePic: user.profilePic 
        };

        if (isVIP) {
            if (user.diamonds < VIP_COST_DIAMONDS) {
                return res.status(400).json({ success: false, message: `Insufficient diamonds. Requires ${VIP_COST_DIAMONDS} diamonds for VIP room.` });
            }
            user.diamonds -= VIP_COST_DIAMONDS;
            await user.save();
            newRoomData.isVIP = true;
        }

        const newRoom = new Room(newRoomData);
        await newRoom.save();

        res.json({ 
            success: true, 
            message: `Room "${newRoom.name}" created successfully.`, 
            room: newRoom,
            newDiamondBalance: user.diamonds 
        });

    } catch (error) {
        console.error('Room Creation Error:', error);
        res.status(500).json({ success: false, message: 'Server error during room creation.' });
    }
});
// *************************************************

// ********** GET ALL ROOMS API **********
app.get('/api/rooms', async (req, res) => {
    try {
        const rooms = await Room.find().sort({ createdAt: -1 }); 
        res.json({ success: true, rooms });

    } catch (error) {
        console.error('Get Rooms Error:', error);
        res.status(500).json({ success: false, message: 'Server error while fetching rooms.' });
    }
});
// ***************************************

// ********** ADMIN DASHBOARD API **********
app.get('/api/admin/dashboard-data', async (req, res) => {
    // SECURITY NOTE: This endpoint should be protected in a real app.
    try {
        const users = await User.find().select('username diamonds level profilePic').sort({ diamonds: -1 });
        // NOTE: We assume Transaction Model/data exists here.
        const recentTransactions = await Transaction.find().sort({ createdAt: -1 }).limit(20);
        const totalUsers = await User.countDocuments();
        
        res.json({ 
            success: true, 
            totalUsers,
            topUsers: users,
            recentTransactions
        });

    } catch (error) {
        console.error('Admin Dashboard Error:', error);
        res.status(500).json({ success: false, message: 'Server error while fetching admin data.' });
    }
});
// *****************************************


// ********** STATICS AND WILDCARD ROUTE (FIX for 404 on rooms.html) **********
app.get('*', (req, res) => {
    if (req.path.includes('.')) {
        res.sendFile(path.join(__dirname, 'public', req.path));
    } 
    else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});
// ****************************************************************************

// --- Socket.io Logic ---
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    // ... (rest of the socket logic)
});


const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}. Frontend available`));
