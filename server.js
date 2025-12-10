// server.js (FINAL, COMPLETE, AND INTEGRATED CODE)

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer'); 
const fs = require('fs');         

// --- Import Models (CRITICAL: Ensure these models exist in models/ folder) ---
// **NOTE: If you haven't created these models yet, you MUST create them.**
const User = require('./models/User'); 
const Transaction = require('./models/Transaction'); 
const Room = require('./models/Room'); 
const RechargeRequest = require('./models/RechargeRequest'); 

// --- Import Utilities ---
const { calculateNewLevel } = require('./utils/leveling'); 

// --- App Setup ---
const app = express();
app.use(cors());
app.use(express.json());

// Create upload directory if it doesn't exist
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// **CRITICAL:** Serve static files and uploaded files
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

// **Multer Storage Configuration for Recharge Screenshots and Profile Pics**
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const type = file.fieldname.includes('profile') ? 'profile' : 'recharge';
        const ext = path.extname(file.originalname);
        cb(null, `${type}-${req.body.username || req.body.currentUsername || 'unknown'}-${Date.now()}${ext}`);
    }
});
const upload = multer({ storage: storage }); 

// --- Active Room States (In-memory store for Socket.io) ---
const activeRooms = {}; 
const MAX_SIT_SLOTS = 15; 

// --- API Routes ---

// ********** 1. LOGIN/REGISTRATION API **********
app.post('/api/login', async (req, res) => {
    const { username } = req.body;
    try {
        let user = await User.findOne({ username });
        if (!user) {
            user = new User({ username, diamonds: 500, level: 0, coins: 0 }); 
            await user.save();
            return res.json({ success: true, message: 'Registration successful! 500 💎 credited.', user });
        } else {
            return res.json({ success: true, message: 'Login successful!', user });
        }
    } catch (error) {
        console.error('Login/Registration Runtime Error:', error.message);
        res.status(500).json({ success: false, message: 'Server error during authentication: ' + error.message });
    }
});
// *********************************************************

// ********** 2. GET ALL ROOMS API **********
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

// ********** 3. ROOM CREATION API **********
app.post('/api/room/create', async (req, res) => {
    const { username, roomName, isVIP } = req.body;
    const VIP_COST_DIAMONDS = 200; 

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await User.findOne({ username }).session(session);
        if (!user) {
            await session.abortTransaction(); session.endSession();
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const existingRoom = await Room.findOne({ ownerUsername: username }).session(session);
        if (existingRoom) {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: `You already own room: ${existingRoom.name}.` });
        }
        
        let newRoomData = {
            name: roomName,
            ownerUsername: username,
            roomId: Date.now().toString().slice(-5), 
            isVIP: false,
            ownerProfilePic: user.profilePic || 'https://i.pravatar.cc/150?img=1'
        };

        if (isVIP) {
            if (user.diamonds < VIP_COST_DIAMONDS) {
                await session.abortTransaction(); session.endSession();
                return res.status(400).json({ success: false, message: `Insufficient diamonds. Requires ${VIP_COST_DIAMONDS} diamonds for VIP room.` });
            }
            
            user.diamonds -= VIP_COST_DIAMONDS;
            await user.save({ session });
            
            await new Transaction({
                username: username,
                type: 'room_creation_fee',
                amount: VIP_COST_DIAMONDS,
                details: `Created VIP room: ${roomName}`
            }).save({ session });
            
            newRoomData.isVIP = true;
        }

        const newRoom = new Room(newRoomData);
        await newRoom.save({ session });
        await session.commitTransaction(); session.endSession();

        res.json({ 
            success: true, 
            message: `Room "${newRoom.name}" created successfully.`, 
            room: newRoom,
            newDiamondBalance: user.diamonds 
        });

    } catch (error) {
        await session.abortTransaction(); session.endSession();
        console.error('Room Creation Error:', error);
        res.status(500).json({ success: false, message: 'Server error during room creation.' });
    }
});
// *************************************************

// ********** 4. USER PROFILE UPDATE API **********
app.post('/api/user/profile/update', upload.single('profilePic'), async (req, res) => {
    const { currentUsername, newUsername } = req.body;
    const newImagePath = req.file ? `/uploads/${req.file.filename}` : null;
    
    try {
        const updateFields = {};
        
        // 1. Check/Update Username
        if (newUsername && newUsername !== currentUsername) {
            const existingUser = await User.findOne({ username: newUsername });
            if (existingUser) {
                 if (newImagePath && req.file) fs.unlinkSync(req.file.path);
                 return res.status(400).json({ success: false, message: 'Username already taken.' });
            }
            updateFields.username = newUsername;
        }

        // 2. Update Profile Picture
        if (newImagePath) {
            updateFields.profilePic = newImagePath;
        }

        const updatedUser = await User.findOneAndUpdate(
            { username: currentUsername },
            { $set: updateFields },
            { new: true }
        );
        
        if (!updatedUser) {
             if (newImagePath && req.file) fs.unlinkSync(req.file.path);
             return res.status(404).json({ success: false, message: 'Original user not found.' });
        }

        res.json({ success: true, message: 'Profile updated successfully.', user: updatedUser });

    } catch (error) {
        console.error('Profile Update Error:', error);
        res.status(500).json({ success: false, message: 'Server error during profile update.' });
    }
});
// ************************************************************

// ********** 5. COIN TO DIAMOND EXCHANGE **********
app.post('/api/exchange/coin-to-diamond', async (req, res) => {
    const { username } = req.body;
    const COINS_PER_DIAMOND = 10; 
    const MIN_COINS_EXCHANGE = 100;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await User.findOne({ username }).session(session);

        if (!user || user.coins < MIN_COINS_EXCHANGE) {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: `Minimum ${MIN_COINS_EXCHANGE} coins required for exchange.` });
        }

        const diamondsToCredit = Math.floor(user.coins / COINS_PER_DIAMOND);
        const coinsToDeduct = diamondsToCredit * COINS_PER_DIAMOND;

        if (diamondsToCredit === 0) {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: 'Not enough coins for a full exchange.' });
        }

        // 1. Update user balance
        user.coins -= coinsToDeduct;
        user.diamonds += diamondsToCredit;
        await user.save({ session });

        // 2. Log transaction
        await new Transaction({
            username,
            type: 'coin_exchange',
            amount: diamondsToCredit, 
            details: `Exchanged ${coinsToDeduct} Coins for ${diamondsToCredit} 💎`
        }).save({ session });
        
        await session.commitTransaction(); session.endSession();

        res.json({ 
            success: true, 
            message: `${coinsToDeduct} Coins exchanged for ${diamondsToCredit} 💎.`,
            newDiamondBalance: user.diamonds,
            newCoinBalance: user.coins
        });

    } catch (error) {
        await session.abortTransaction(); session.endSession();
        console.error('Coin Exchange Error:', error);
        res.status(500).json({ success: false, message: 'Server error during coin exchange.' });
    }
});
// ************************************************************

// ********** 6. RECHARGE REQUEST API (Client Submission) **********
app.post('/api/recharge/request', upload.single('screenshot'), async (req, res) => {
    const { username, paidAmount, diamondAmount, utrNumber } = req.body;
    const screenshotUrl = req.file ? `/uploads/${req.file.filename}` : null;

    if (!username || !utrNumber || !screenshotUrl || !paidAmount || !diamondAmount) {
        if (req.file) fs.unlinkSync(req.file.path); 
        return res.status(400).json({ success: false, message: 'Missing required fields (UTR or Screenshot).' });
    }

    try {
        const existingRequest = await RechargeRequest.findOne({ utrNumber: utrNumber, status: 'pending' });
        if (existingRequest) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, message: 'A pending request with this UTR number already exists.' });
        }

        const newRequest = new RechargeRequest({
            username,
            paidAmount: parseFloat(paidAmount),
            diamondAmount: parseInt(diamondAmount),
            utrNumber,
            screenshotUrl,
            status: 'pending'
        });

        await newRequest.save();
        res.json({ success: true, message: 'Recharge request submitted for verification.' });

    } catch (error) {
        console.error('Recharge Request Error:', error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, message: 'Server error during submission.' });
    }
});
// ************************************************************

// ********** 7. ADMIN: GET PENDING RECHARGE REQUESTS **********
app.get('/api/admin/recharge/requests', async (req, res) => {
    try {
        const statusFilter = req.query.status || 'pending';
        const requests = await RechargeRequest.find({ status: statusFilter }).sort({ createdAt: 1 });
        res.json({ success: true, requests });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error fetching requests.' });
    }
});
// **********************************************************

// ********** 8. ADMIN: RECHARGE ACTION (ACCEPT/REJECT) **********
app.post('/api/admin/recharge/action', async (req, res) => {
    const { requestId, action, adminUsername } = req.body;
    
    if (action !== 'accepted' && action !== 'rejected') {
        return res.status(400).json({ success: false, message: 'Invalid action.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction(); 

    try {
        const request = await RechargeRequest.findById(requestId).session(session);

        if (!request || request.status !== 'pending') {
            await session.abortTransaction(); session.endSession();
            return res.status(400).json({ success: false, message: 'Request not found or already processed.' });
        }
        
        // 1. Update Request Status
        request.status = action;
        request.adminActionBy = adminUsername;
        request.updatedAt = Date.now();
        await request.save({ session });

        let successMessage = `Request rejected for user ${request.username}.`;
        
        if (action === 'accepted') {
            const diamondAmount = request.diamondAmount;
            
            // 2. Add diamonds to the user's wallet
            const user = await User.findOneAndUpdate(
                { username: request.username },
                { $inc: { diamonds: diamondAmount } },
                { new: true, session }
            );

            // 3. Log the transaction
            await new Transaction({
                username: request.username,
                type: 'recharge_credit',
                amount: diamondAmount, 
                details: `Recharge accepted by ${adminUsername}. Credited ${diamondAmount} 💎`
            }).save({ session });
            
            successMessage = `Accepted! ${diamondAmount} 💎 credited to ${request.username}. New Balance: ${user.diamonds}`;
        }
        
        // 4. Remove screenshot file after processing (Cleanup)
        if (request.screenshotUrl) {
            const filePath = path.join(__dirname, 'public', request.screenshotUrl);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await session.commitTransaction(); 
        session.endSession();
        
        res.json({ success: true, message: successMessage });

    } catch (error) {
        await session.abortTransaction(); 
        session.endSession();
        console.error('Recharge Action Error:', error);
        res.status(500).json({ success: false, message: 'Server error during transaction process.' });
    }
});
// **************************************************************


// --- Socket.io Logic (Gifting, Mic Slots, Chat) ---

io.on('connection', (socket) => {
    
    // --- 1. Join Room ---
    socket.on('joinRoom', async ({ roomId, username }) => { 
        socket.join(roomId);
        
        try {
            const room = await Room.findOne({ roomId });
            if (!room) {
                socket.emit('systemMessage', { text: 'Error: Room not found.' });
                return;
            }
            
            if (!activeRooms[roomId]) {
                activeRooms[roomId] = {
                    info: room,
                    micSlots: {}, // Key: slot number, Value: { username, avatar }
                    users: {} // Key: username, Value: socketId
                };
            }
            
            activeRooms[roomId].users[username] = socket.id;

            // Initialize Mic Slot 1 (Owner)
            if (!activeRooms[roomId].micSlots[1]) {
                const owner = await User.findOne({ username: room.ownerUsername });
                if (owner) {
                    activeRooms[roomId].micSlots[1] = {
                        username: room.ownerUsername,
                        avatar: owner.profilePic || 'https://i.pravatar.cc/150?img=1'
                    };
                }
            }
            
            // Send initial room state to the joining user
            socket.emit('roomInfo', {
                name: room.name,
                roomLevel: room.roomLevel,
                ownerUsername: room.ownerUsername,
                ownerProfilePic: room.ownerProfilePic
            });
            socket.emit('initialMicState', activeRooms[roomId].micSlots);
            
            // Notify others
            io.to(roomId).emit('message', { type: 'system', username: 'System', text: `${username} has joined the room.` });

        } catch (error) {
            console.error('Join Room Error:', error);
        }
    });

    // --- 2. Handle Chat Messages ---
    socket.on('sendMessage', ({ roomId, username, text }) => { 
        io.to(roomId).emit('message', { type: 'chat', username, text });
    });

    // --- 3. Mic Slot Request (Sit Logic) ---
    socket.on('requestMic', async ({ roomId, slot, username }) => { 
        const roomState = activeRooms[roomId];
        if (!roomState) return;

        try {
            const user = await User.findOne({ username });
            if (!user) return;

            if (slot === 1 && username !== roomState.info.ownerUsername) {
                // Only owner can be on slot 1
                socket.emit('message', { type: 'system', text: 'Mic #1 is reserved for the room owner.' });
                return;
            }

            if (roomState.micSlots[slot]) {
                socket.emit('message', { type: 'system', text: `Mic #${slot} is already occupied.` });
                return;
            }
            
            // Clear user from any previous mic slot
            for (const key in roomState.micSlots) {
                if (roomState.micSlots[key].username === username) {
                    delete roomState.micSlots[key];
                    io.to(roomId).emit('micUpdate', { slot: key, user: null, avatar: null });
                    break;
                }
            }

            // Occupy the new slot
            roomState.micSlots[slot] = {
                username: username,
                avatar: user.profilePic || 'https://i.pravatar.cc/150?img=1'
            };

            // Broadcast the update
            io.to(roomId).emit('micUpdate', { 
                slot: slot, 
                user: username, 
                avatar: roomState.micSlots[slot].avatar 
            });
            io.to(roomId).emit('message', { type: 'system', text: `${username} sat on Mic #${slot}.` });

        } catch (error) {
            console.error('Request Mic Error:', error);
        }
    });

    // --- 4. Handle Gifts (Gifting, Coins, and Leveling) ---
    socket.on('sendGift', async ({ roomId, username, giftName, diamondCost, quantity }) => { 
        const roomState = activeRooms[roomId];
        if (!roomState) return;
        const totalCost = diamondCost * quantity;
        
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const user = await User.findOne({ username }).session(session);
            const room = await Room.findOne({ roomId }).session(session);

            if (!user || user.diamonds < totalCost || !room) {
                await session.abortTransaction(); session.endSession();
                socket.emit('message', { type: 'system', text: 'Transaction failed: Insufficient diamonds or invalid room/user.' });
                return;
            }

            // 1. Deduct diamonds from sender
            user.diamonds -= totalCost;
            await user.save({ session });

            // 2. Credit coins to room owner
            const owner = await User.findOne({ username: room.ownerUsername }).session(session);
            const coinsToCredit = totalCost * 0.5; // Example: Owner gets 50% of diamond value as coins
            owner.coins += coinsToCredit;
            
            // 3. Update owner level (Example: 1 XP per diamond spent)
            owner.experience += totalCost;
