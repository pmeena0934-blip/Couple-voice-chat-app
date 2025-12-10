// server.js (Complete File - FINAL CODE)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// --- Import Models (Ensure these models exist in models/ folder) ---
// NOTE: Make sure models/User.js, models/Room.js, models/Transaction.js, models/Gift.js exist
const User = require('./models/User'); 
const Transaction = require('./models/Transaction'); 
const Gift = require('./models/Gift'); 
const Room = require('./models/Room'); 

// --- App Setup ---
const app = express();
app.use(cors());
app.use(express.json());

// **CRITICAL FIX:** Serve static files correctly from the 'public' directory
app.use(express.static(path.join(__dirname, 'public'))); 

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
  })
  .catch(err => {
    console.error('MongoDB Atlas Connection Error:', err);
    process.exit(1); 
  });

// --- API Routes ---

// ********** LOGIN/REGISTRATION API ROUTE **********
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
            ownerProfilePic: user.profilePic || 'https://i.pravatar.cc/150?img=1'
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
    try {
        const users = await User.find().select('username diamonds level profilePic').sort({ diamonds: -1 });
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


// --- Socket.io Logic ---

// --- Active Room States (Simple in-memory store) ---
const activeRooms = {}; // { roomId: { name: '...', ownerUsername: '...', micSlots: { 1: user, 2: null } } }

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    
    // --- 1. Join Room ---
    socket.on('joinRoom', async ({ roomId, username }) => {
        socket.join(roomId);
        socket.currentRoom = roomId;
        socket.username = username;
        
        // Fetch room info (for owner name etc.)
        const room = await Room.findOne({ roomId });
        if (room) {
             socket.emit('roomInfo', {
                 name: room.name,
                 roomId: room.roomId,
                 ownerUsername: room.ownerUsername
             });
             
             // Announce join to the room
             io.to(roomId).emit('message', {
                 type: 'system',
                 text: `${username} has joined the room.`,
                 username: 'System'
             });

             // Initialize activeRooms state if it doesn't exist
             if (!activeRooms[roomId]) {
                activeRooms[roomId] = { micSlots: {} };
             }
             
             // Send initial mic state to the joining user
             socket.emit('initialMicState', activeRooms[roomId].micSlots); 
        }
        console.log(`${username} joined room ${roomId}`);
    });

    // --- 2. Handle Chat Messages ---
    socket.on('sendMessage', ({ roomId, username, text }) => {
        io.to(roomId).emit('message', { type: 'chat', username, text });
    });

    // --- 3. Handle Gifts (Simplified) ---
    socket.on('sendGift', async ({ roomId, username, giftName, diamondCost }) => {
        // PRODUCTION NOTE: Here, you must deduct diamonds from the User model first!
        
        io.to(roomId).emit('message', {
            type: 'gift',
            username,
            giftName,
            text: `${username} sent a ${giftName}!`
        });
        
        // Broadcast a diamond update if needed
    });

    // --- 4. Mic Slot Request (Simplified: Everyone can take an empty mic) ---
    socket.on('requestMic', async ({ roomId, slot, username }) => {
        if (!activeRooms[roomId] || activeRooms[roomId].micSlots[slot]) {
            // Mic is already taken or room doesn't exist in memory
            return;
        }

        const user = await User.findOne({ username });
        const avatarUrl = user ? user.profilePic : 'https://i.pravatar.cc/150?img=10';

        // Update mic state in memory
        activeRooms[roomId].micSlots[slot] = { 
            username: username,
            avatar: avatarUrl,
            socketId: socket.id
        };

        // Broadcast the update to all users in the room
        io.to(roomId).emit('micUpdate', {
            slot: slot,
            user: username,
            avatar: avatarUrl
        });
        
        io.to(roomId).emit('message', {
            type: 'system',
            text: `${username} took Mic ${slot}.`,
            username: 'System'
        });
    });
    
    // --- 5. Disconnect Logic (IMPORTANT) ---
    socket.on('disconnect', () => {
        if (socket.currentRoom) {
            console.log(`${socket.username} left room ${socket.currentRoom}`);
            
            // Remove user from any mic slots they occupied
            for (let slot in activeRooms[socket.currentRoom].micSlots) {
                if (activeRooms[socket.currentRoom].micSlots[slot].socketId === socket.id) {
                    delete activeRooms[socket.currentRoom].micSlots[slot];
                    
                    io.to(socket.currentRoom).emit('micUpdate', {
                        slot: parseInt(slot),
                        user: null,
                        avatar: null
                    });
                    
                    io.to(socket.currentRoom).emit('message', {
                        type: 'system',
                        text: `${socket.username} released Mic ${slot}.`,
                        username: 'System'
                    });
                }
            }
        }
    });
});


// ********** STATICS AND WILDCARD ROUTE (FIXED) **********
app.get('/', (req, res) => {
    // Root path always serves index.html
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Explicitly handle rooms.html
app.get('/rooms.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'rooms.html'));
});

// Explicitly handle room.html (The new Live Chat Page)
app.get('/room.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'room.html'));
});

// Fallback for any other HTML files or paths (e.g., /admin.html)
app.get('/*.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', req.path));
});

// Catch-all 404 handler
app.get('*', (req, res) => {
    res.status(404).send('File not found or API error.');
});
// ****************************************************************************

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}. Frontend available`));
  
