// --- server.js (Final Complete and Corrected Backend Logic) ---

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// --- Configuration and Middleware ---
const PORT = process.env.PORT || 10000;

// Set up storage for uploaded files (profile pictures)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Create the uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// --- FAKE DATABASE (In-Memory for demonstration) ---
const users = {}; // { username: { password, diamonds, coins, ... } }
const rooms = {}; // { roomId: { name, ownerUsername, micSlots, usersCount } }
let nextRoomId = 10000;

// --- User Model Structure (Default) ---
function createNewUser(username, password) {
    return {
        username: username,
        password: password,
        id: Math.floor(100000000 + Math.random() * 900000000),
        diamonds: 500, // Starting Diamonds
        coins: 10,   // Starting Coins
        level: 1,
        charisma: 0,
        contribution: 0,
        profilePic: 'https://i.pravatar.cc/150?img=' + Math.floor(Math.random() * 20),
        socketId: null
    };
}

// --- Room Model Structure ---
function createNewRoom(name, ownerUsername) {
    const micSlots = {};
    for (let i = 1; i <= 10; i++) {
        micSlots[i] = { username: null, avatar: null }; // Empty slot
    }
    // Owner is always on Mic 1
    const owner = users[ownerUsername];
    micSlots[1] = { 
        username: owner.username, 
        avatar: owner.profilePic 
    };

    return {
        id: nextRoomId++,
        name: name,
        ownerUsername: ownerUsername,
        roomLevel: 1,
        micSlots: micSlots,
        usersCount: 0,
        currentUsers: {} // { socketId: username }
    };
}

// --- API Routes (Login, Register, Rooms) ---

// 1. Root/Home Route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 2. Registration
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (users[username]) {
        return res.json({ success: false, message: 'Username already taken.' });
    }
    const newUser = createNewUser(username, password);
    users[username] = newUser;
    console.log(`New user registered: ${username}`);
    res.json({ success: true, message: 'Registration successful. Please log in.', user: newUser });
});

// 3. Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = users[username];
    if (!user || user.password !== password) {
        return res.json({ success: false, message: 'Invalid username or password.' });
    }
    res.json({ success: true, message: 'Login successful.', user: user });
});

// 4. Create Room
app.post('/api/rooms/create', (req, res) => {
    const { roomName, ownerUsername } = req.body;
    if (!users[ownerUsername]) {
        return res.json({ success: false, message: 'Owner not found.' });
    }
    const newRoom = createNewRoom(roomName, ownerUsername);
    rooms[newRoom.id] = newRoom;
    console.log(`Room created: ${newRoom.name} (ID: ${newRoom.id})`);
    res.json({ success: true, message: 'Room created successfully.', room: newRoom });
});

// 5. Get All Rooms
app.get('/api/rooms', (req, res) => {
    const roomList = Object.values(rooms).map(room => ({
        id: room.id,
        name: room.name,
        ownerUsername: room.ownerUsername,
        usersCount: room.usersCount,
        roomLevel: room.roomLevel
    }));
    res.json({ success: true, rooms: roomList });
});

// 6. Coin to Diamond Exchange
app.post('/api/exchange/coin-to-diamond', (req, res) => {
    const { username } = req.body;
    const user = users[username];

    if (!user) {
        return res.json({ success: false, message: 'User not found.' });
    }

    const exchangeRate = 10; // 10 Coins = 1 Diamond
    const coinsToExchange = 100; // Example: Minimum exchange amount
    
    if (user.coins < coinsToExchange) {
        return res.json({ success: false, message: `Need at least ${coinsToExchange} Coins for exchange.` });
    }
    
    const diamondsGained = Math.floor(user.coins / exchangeRate);
    const coinsDeducted = diamondsGained * exchangeRate;

    user.coins -= coinsDeducted;
    user.diamonds += diamondsGained;

    console.log(`${username} exchanged ${coinsDeducted} Coins for ${diamondsGained} Diamonds.`);
    
    res.json({ 
        success: true, 
        message: `${diamondsGained} Diamonds added to your balance!`,
        newDiamondBalance: user.diamonds,
        newCoinBalance: user.coins
    });
});

// 7. Profile Update (Handling file upload for profile pic)
app.post('/api/user/profile/update', upload.single('profilePic'), (req, res) => {
    const { currentUsername, newUsername } = req.body;
    const profilePicFile = req.file;

    let user = users[currentUsername];
    if (!user) {
        return res.json({ success: false, message: 'User not found.' });
    }

    // Handle Username change
    if (newUsername && newUsername !== currentUsername) {
        if (users[newUsername]) {
            // If the new username is already taken
            return res.json({ success: false, message: 'New username is already taken.' });
        }
        
        // Update username in the global user list and delete the old entry
        user.username = newUsername;
        users[newUsername] = user;
        delete users[currentUsername];
    }
    
    // Handle Profile Picture update
    if (profilePicFile) {
        // The file is saved in public/uploads. Update the path in user data.
        user.profilePic = `/uploads/${profilePicFile.filename}`;
    }

    console.log(`Profile updated for: ${user.username}`);
    res.json({ success: true, message: 'Profile updated.', user: user });
});


// --- Socket.io Logic (Live Chat and Mic Management) ---

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    let currentRoomId = null;

    // --- 1. Join Room ---
    socket.on('joinRoom', ({ roomId, username }) => {
        if (!rooms[roomId] || !users[username]) {
            return socket.emit('error', 'Room or User not found.');
        }

        currentRoomId = roomId;
        const room = rooms[roomId];
        const user = users[username];
        
        socket.join(roomId);
        room.usersCount++;
        room.currentUsers[socket.id] = username;
        user.socketId = socket.id;

        console.log(`${username} joined room ${roomId}`);
        
        // Send initial room info and mic state to the joining user
        socket.emit('roomInfo', {
            name: room.name,
            roomLevel: room.roomLevel,
            ownerUsername: room.ownerUsername,
            ownerProfilePic: users[room.ownerUsername].profilePic
        });
        socket.emit('initialMicState', room.micSlots);
        
        // Notify everyone in the room
        io.to(roomId).emit('message', { type: 'system', text: `${username} has joined the room.` });
    });

    // --- 2. Mic Request ---
    socket.on('requestMic', ({ roomId, slot, username }) => {
        const room = rooms[roomId];
        const user = users[username];

        if (!room || !user) return;
        if (room.micSlots[slot].username) {
            return socket.emit('message', { type: 'system', text: `Mic ${slot} is already occupied.` });
        }
        
        // Occupy the mic slot
        room.micSlots[slot] = { username: username, avatar: user.profilePic };
        
        // Broadcast the update
        io.to(roomId).emit('micUpdate', { 
            slot: slot, 
            user: username, 
            avatar: user.profilePic 
        });
        io.to(roomId).emit('message', { 
            type: 'system', 
            text: `${username} has taken Mic ${slot}.` 
        });
    });

    // --- 3. Send Chat Message ---
    socket.on('sendMessage', ({ roomId, username, text }) => {
        io.to(roomId).emit('message', { type: 'chat', username, text });
        console.log(`Chat in ${roomId} from ${username}: ${text}`);
    });

    // --- 4. Send Gift ---
    socket.on('sendGift', ({ roomId, username, giftName, diamondCost, quantity, targetUsername }) => {
        const sender = users[username];
        const room = rooms[roomId];

        if (!sender || !room) return;

        const totalCost = diamondCost * quantity;
        if (sender.diamonds < totalCost) {
            return socket.emit('message', { type: 'system', text: 'Insufficient diamonds to send gift.' });
        }
        
        // Deduct diamonds from sender
        sender.diamonds -= totalCost;
        
        // Give 'contribution' to sender (for level up)
        sender.contribution += totalCost; 
        
        // Give 'charisma' to target (or room owner for simplicity)
        const target = users[targetUsername];
        if (target) {
            target.charisma += totalCost;
        }

        // Check for level up (simplistic example)
        let newLevel = sender.level;
        if (sender.contribution >= sender.level * 10000) { // Example logic
            sender.level++;
            newLevel = sender.level;
            io.to(roomId).emit('message', { 
                type: 'system', 
                text: `${username} leveled up to Lv. ${sender.level}!` 
            });
        }
        
        // Notify sender of diamond balance update
        socket.emit('diamondUpdate', { 
            newBalance: sender.diamonds, 
            newLevel: newLevel 
        });

        // Broadcast gift message to everyone in the room
        io.to(roomId).emit('message', { 
            type: 'gift', 
            username: username, 
            text: `${quantity}x ${giftName} to ${targetUsername}` 
        });
        console.log(`${username} sent ${quantity}x ${giftName} in room ${roomId}`);
    });

    // --- 5. Disconnect ---
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (currentRoomId && rooms[currentRoomId]) {
            const room = rooms[currentRoomId];
            const username = room.currentUsers[socket.id];
            
            if (username) {
                // Remove user from room and update count
                room.usersCount--;
                delete room.currentUsers[socket.id];
                
                // Remove user from mic slot if they were on one
                for (let i = 1; i <= 10; i++) {
                    if (room.micSlots[i].username === username) {
                        room.micSlots[i] = { username: null, avatar: null };
                        io.to(currentRoomId).emit('micUpdate', { 
                            slot: i, 
                            user: null, 
                            avatar: null 
                        });
                    }
                }
                
                // Notify room members
                io.to(currentRoomId).emit('message', { 
                    type: 'system', 
                    text: `${username} has left the room.` 
                });
            }
        }
    });

});

// --- Initial Dummy Data for Testing ---
users['testuser'] = createNewUser('testuser', 'password');
users['testuser'].diamonds = 10000;
users['Meena9090'] = createNewUser('Meena9090', '12345');
users['Meena9090'].diamonds = 500;
rooms[14931] = createNewRoom('Yaro ki duniya', 'Meena9090');
rooms[14931].id = 14931; // Fix ID for consistency


// --- Start Server ---
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Frontend available on http://localhost:${PORT}`);
});
// --- End of server.js ---
        
