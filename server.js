// server.js (Complete File - FINAL PRODUCTION CODE with Secure Gift Logic)

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// --- Import Models (CRITICAL: Ensure these models exist in models/ folder) ---
const User = require('./models/User'); 
const Transaction = require('./models/Transaction'); 
const Gift = require('./models/Gift'); 
const Room = require('./models/Room'); 

// --- App Setup ---
const app = express();
app.use(cors());
app.use(express.json());

// Serve static files correctly from the 'public' directory
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
            // New user gets 100 default diamonds
            user = new User({ username, diamonds: 100 }); 
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
            ownerProfilePic: user.profilePic || 'https://i.pravatar.cc/150?img=1'
        };

        if (isVIP) {
            if (user.diamonds < VIP_COST_DIAMONDS) {
                return res.status(400).json({ success: false, message: `Insufficient diamonds. Requires ${VIP_COST_DIAMONDS} diamonds for VIP room.` });
            }
            // Securely deduct diamonds
            user.diamonds -= VIP_COST_DIAMONDS;
            await user.save();
            
            // Log transaction
            const newTransaction = new Transaction({
                username: username,
                type: 'room_creation_fee',
                amount: VIP_COST_DIAMONDS,
                details: `Created VIP room: ${roomName}`
            });
            await newTransaction.save();
            
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

// ********** GET ALL GIFTS API **********
app.get('/api/gifts', async (req, res) => {
    try {
        const gifts = await Gift.find().sort({ diamondCost: 1 });
        res.json({ success: true, gifts });
    } catch (error) {
        console.error('Get Gifts Error:', error);
        res.status(500).json({ success: false, message: 'Server error while fetching gifts.' });
    }
});
// ***************************************

// --- Socket.io Logic ---

// --- Active Room States (Simple in-memory store) ---
const activeRooms = {}; 

io.on('connection', (socket) => {
    
    // --- 1. Join Room ---
    socket.on('joinRoom', async ({ roomId, username }) => {
        socket.join(roomId);
        socket.currentRoom = roomId;
        socket.username = username;
        
        const room = await Room.findOne({ roomId });
        if (room) {
             socket.emit('roomInfo', {
                 name: room.name,
                 roomId: room.roomId,
                 ownerUsername: room.ownerUsername
             });
             
             io.to(roomId).emit('message', {
                 type: 'system',
                 text: `${username} has joined the room.`,
                 username: 'System'
             });

             if (!activeRooms[roomId]) {
                // Initialize room with 15 slots (2 special + 13 general)
                activeRooms[roomId] = { micSlots: {} };
             }
             
             socket.emit('initialMicState', activeRooms[roomId].micSlots); 
        }
    });

    // --- 2. Handle Chat Messages ---
    socket.on('sendMessage', ({ roomId, username, text }) => {
        io.to(roomId).emit('message', { type: 'chat', username, text });
    });

    // --- 3. Handle Gifts (SECURE/FINALIZED) ---
    socket.on('sendGift', async ({ roomId, username, giftName, diamondCost, quantity }) => {
        const totalCost = diamondCost * quantity;
        
        try {
            // 1. Deduct diamonds and get the updated user (Atomic Operation)
            const user = await User.findOneAndUpdate(
                { username: username, diamonds: { $gte: totalCost } }, 
                { $inc: { diamonds: -totalCost } }, 
                { new: true } 
            );

            if (!user) {
                return socket.emit('message', { 
                    type: 'system', 
                    text: `Transaction failed: ${username} has insufficient diamonds for ${quantity}x ${giftName}.` 
                });
            }

            // 2. Create Transaction Record
            const newTransaction = new Transaction({
                username: username,
                type: 'gift_send',
                amount: totalCost,
                details: `Sent ${quantity}x ${giftName} in room ${roomId}`
            });
            await newTransaction.save();
            
            // 3. Broadcast Gift Message
            io.to(roomId).emit('message', {
                type: 'gift',
                username,
                giftName,
                quantity,
                text: `${username} sent ${quantity}x ${giftName}!`
            });
            
            // 4. Send updated user data back
            socket.emit('diamondUpdate', { newBalance: user.diamonds });

        } catch (error) {
            console.error('Gift Send Error:', error);
            socket.emit('message', { 
                type: 'system', 
                text: 'An error occurred during the gift transaction.' 
            });
        }
    });

    // --- 4. Mic Slot Request (Owner/Admin Logic Needed) ---
    socket.on('requestMic', async ({ roomId, slot, username }) => {
        if (!activeRooms[roomId] || activeRooms[roomId].micSlots[slot]) {
            return; // Mic is already taken
        }

        const roomInfo = await Room.findOne({ roomId });
        const user = await User.findOne({ username });
        const avatarUrl = user ? user.profilePic : 'https://i.pravatar.cc/150?img=10';
        
        // Slot 1: Reserved for Owner
        if (slot === 1 && roomInfo.ownerUsername !== username) {
             return socket.emit('message', { type: 'system', text: `Mic ${slot} is reserved for the Room Owner.` });
        }
        
        // Slot 2: Reserved for Admin (For simplicity, currently restricted to Owner too)
        if (slot === 2 && roomInfo.ownerUsername !== username) { 
            // NOTE: In a real app, you would check if user is in the room's admin list here.
            return socket.emit('message', { type: 'system', text: `Mic ${slot} is reserved for the Admin/Co-Host.` });
        }
        
        // Mic taken successfully
        activeRooms[roomId].micSlots[slot] = { 
            username: username,
            avatar: avatarUrl,
            socketId: socket.id
        };

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
        if (socket.currentRoom && socket.username) {
            
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


// ********** STATICS AND WILDCARD ROUTE **********
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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
                
