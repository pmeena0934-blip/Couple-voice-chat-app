const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// Socket.IO configuration for stability on Render
const io = socketIo(server, {
    cors: {
        origin: "*", // Allow all origins for development/testing
        methods: ["GET", "POST"]
    }
});

// --- Configuration and Setup ---

const PORT = process.env.PORT || 3000; 

// Global data store (in-memory)
let users = {};
let rooms = {};
let roomCounter = 10000; 

// --- User Model ---
function createNewUser(username, password) {
    return {
        username: username,
        password: password,
        id: Math.floor(100000000 + Math.random() * 900000000),
        diamonds: 500, 
        coins: 10,   
        level: 1,
        charisma: 0,
        contribution: 0,
        profilePic: 'https://i.pravatar.cc/150?img=' + Math.floor(Math.random() * 20),
        socketId: null,
        following: new Set(), 
        followers: new Set()  
    };
}

// Initialize test users
if (!users['Meena9090']) {
    users['Meena9090'] = createNewUser('Meena9090', 'test1234');
    users['cjgjj'] = createNewUser('cjgjj', 'test1234');
    users['testuser'] = createNewUser('testuser', 'test1234'); 
}


// --- Middleware ---

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// --- File Upload Configuration (Multer) ---

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Ensure the directory is correct
        cb(null, 'public/uploads/'); 
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created public/uploads directory.');
}


// --- API Routes ---

// 1. Root/Home Route (Serve the login page)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 2. Login / Register
app.post('/api/user/login', (req, res) => {
    const { username, password } = req.body;
    let user = users[username];

    if (!user) {
        user = createNewUser(username, password);
        users[username] = user;
    } else if (user.password !== password) {
        return res.status(401).json({ success: false, message: 'Incorrect password.' });
    }
    
    const userData = { 
        ...user, 
        following: Array.from(user.following || []),
        followers: Array.from(user.followers || [])
    };

    res.json({ 
        success: true, 
        message: 'Login successful.',
        user: userData
    });
});

// 3. Get User Data
app.get('/api/user/:username', (req, res) => {
    const { username } = req.params;
    const user = users[username];
    
    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const userData = { 
        ...user, 
        following: Array.from(user.following || []),
        followers: Array.from(user.followers || [])
    };

    res.json({ success: true, user: userData });
});


// 4. Update Profile Picture
app.post('/api/user/profile/update/pic', upload.single('profilePic'), (req, res) => {
    const { username } = req.body;
    const user = users[username];

    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
    }
    
    if (req.file) {
        user.profilePic = `/uploads/${req.file.filename}`; 
        
        res.json({ 
            success: true, 
            message: 'Profile picture updated successfully.',
            newPicUrl: user.profilePic
        });
    } else {
        res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
});


// 5. Room Management (Create, List, Get Single)

app.post('/api/rooms/create', (req, res) => {
    const { roomName, ownerUsername } = req.body;
    const owner = users[ownerUsername];

    if (!owner) {
        return res.json({ success: false, message: 'Owner not found.' });
    }

    const roomId = ++roomCounter;
    const newRoom = {
        id: roomId,
        name: roomName,
        owner: ownerUsername,
        members: [ownerUsername],
        mics: Array(10).fill(null), 
        isLocked: false,
        type: 'Public' 
    };

    rooms[roomId] = newRoom;
    res.json({ success: true, room: newRoom });
});

app.get('/api/rooms', (req, res) => {
    const roomList = Object.values(rooms);
    res.json({ success: true, rooms: roomList });
});

app.get('/api/rooms/:roomId', (req, res) => {
    const roomId = parseInt(req.params.roomId);
    const room = rooms[roomId];

    if (!room) {
        return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    res.json({ success: true, room: room });
});


// 6. Follow / Unfollow User API 
app.post('/api/user/follow', (req, res) => {
    const { followerUsername, targetUsername, action } = req.body;
    const follower = users[followerUsername];
    const target = users[targetUsername];

    if (!follower || !target) {
        return res.json({ success: false, message: 'User not found.' });
    }
    
    const getCounts = (user) => ({
        followers: user.followers ? user.followers.size : 0,
        following: user.following ? user.following.size : 0
    });
    
    // Check Status Only
    if (action === 'check') {
        const isFollowing = follower.following.has(targetUsername);
        return res.json({ success: true, isFollowing: isFollowing, counts: getCounts(target) });
    }

    // Follow Logic
    if (action === 'follow') {
        if (follower.following.has(targetUsername)) {
            return res.json({ success: true, message: 'Already following.', isFollowing: true, counts: getCounts(target) });
        }
        
        follower.following.add(targetUsername);
        target.followers.add(followerUsername);

        return res.json({ success: true, message: `Successfully followed ${targetUsername}.`, isFollowing: true, counts: getCounts(target) });

    } else if (action === 'unfollow') {
        if (!follower.following.has(targetUsername)) {
            return res.json({ success: true, message: 'Not following.', isFollowing: false, counts: getCounts(target) });
        }
        
        follower.following.delete(targetUsername);
        target.followers.delete(followerUsername);
        
        return res.json({ success: true, message: `Successfully unfollowed ${targetUsername}.`, isFollowing: false, counts: getCounts(target) });
    } else {
        return res.json({ success: false, message: 'Invalid action.' });
    }
});


// --- Socket.IO Logic (Voice Chat) ---

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Join Room
    socket.on('joinRoom', ({ roomId, username }) => {
        socket.join(roomId);
        const room = rooms[roomId];
        const user = users[username];

        if (room && user) {
            if (!room.members.includes(username)) {
                room.members.push(username);
            }
            user.socketId = socket.id;

            io.to(roomId).emit('message', { 
                username: 'System', 
                text: `${username} has joined the room.`, 
                type: 'system' 
            });
            io.to(roomId).emit('roomStateUpdate', room);
        }
    });

    // Send Chat Message
    socket.on('sendMessage', ({ roomId, username, text }) => {
        io.to(roomId).emit('message', { username, text, type: 'chat' });
    });

    // Send Gift (Simplified)
    socket.on('sendGift', ({ roomId, sender, receiver, giftName, diamondsCost }) => {
        const room = rooms[roomId];
        const senderUser = users[sender];

        if (room && senderUser && senderUser.diamonds >= diamondsCost) {
            senderUser.diamonds -= diamondsCost;
            
            io.to(roomId).emit('message', { 
                username: 'System', 
                text: `${sender} sent a ${giftName} to ${receiver || 'the room'}! (Cost: ${diamondsCost}💎)`, 
                type: 'gift' 
            });

            socket.emit('updateBalance', { diamonds: senderUser.diamonds, coins: senderUser.coins });
            io.to(roomId).emit('giftNotification', { sender, giftName, diamondsCost });
            
        } else if (senderUser && senderUser.diamonds < diamondsCost) {
            socket.emit('message', { 
                username: 'System', 
                text: `You need ${diamondsCost - senderUser.diamonds} more 💎 to send ${giftName}.`, 
                type: 'system-error' 
            });
        }
    });

    // Mic Control (Host setting mic)
    socket.on('setMic', ({ roomId, micIndex, username }) => {
        const room = rooms[roomId];
        if (room) {
            if (micIndex >= 1 && micIndex <= 10) {
                room.mics = room.mics.map((micUser, index) => micUser === username ? null : micUser);
                room.mics[micIndex - 1] = username; 
                io.to(roomId).emit('roomStateUpdate', room);
            }
        }
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
        
        for (const username in users) {
            if (users[username].socketId === socket.id) {
                const disconnectedUsername = username;
                
                for (const roomId in rooms) {
                    const room = rooms[roomId];
                    if (room.members.includes(disconnectedUsername)) {
                        room.members = room.members.filter(m => m !== disconnectedUsername);
                        room.mics = room.mics.map(micUser => micUser === disconnectedUsername ? null : micUser);
                        
                        io.to(roomId).emit('message', { 
                            username: 'System', 
                            text: `${disconnectedUsername} has left the room.`, 
                            type: 'system' 
                        });
                        io.to(roomId).emit('roomStateUpdate', room);

                        if (room.owner === disconnectedUsername) {
                            delete rooms[roomId];
                            io.to(roomId).emit('roomClosed', 'Room owner disconnected. The room has been closed.');
                        }
                        break;
                    }
                }
                users[username].socketId = null; 
                break;
            }
        }
    });
});


// --- Start Server ---
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Application started successfully. Ready for use.');
});
                                       
