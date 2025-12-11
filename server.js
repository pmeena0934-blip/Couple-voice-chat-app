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
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// --- Configuration and Setup ---

const PORT = process.env.PORT || 3000; 

// Global data store (in-memory)
let users = {};
let rooms = {};
let roomCounter = 10000; 
let storeItems = [
    { id: 1, name: "Lamborghini", type: "car", price: 17280, duration: "1 Day", img: "/images/lamborghini.png" },
    { id: 2, name: "Hat Bird", type: "gift", price: 17280, duration: "1 Day", img: "/images/hatbird.png" },
    { id: 3, name: "Luxury Love", type: "pair_car", price: 233280, duration: "1 Day", img: "/images/luxurylove.png" },
];

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

// Serving Static Files (HTML, CSS, JS, Images, Uploads) from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// --- Multer Configuration ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/user/login', (req, res) => {
    const { username, password } = req.body;
    let user = users[username];

    if (!user) {
        user = createNewUser(username, password);
        users[username] = user;
    } else if (user.password !== password) {
        return res.status(401).json({ success: false, message: 'Incorrect password.' });
    }
    
    // Convert Sets to Arrays for JSON response
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

// Profile Update API (Handles both pic upload and username change if implemented)
app.post('/api/user/profile/update/pic', upload.single('profilePic'), (req, res) => {
    const { username, newUsername } = req.body;
    const user = users[username];

    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
    }
    
    if (req.file) {
        user.profilePic = `/uploads/${req.file.filename}`; 
    }

    if (newUsername && newUsername !== username) {
        if (users[newUsername]) {
            return res.status(409).json({ success: false, message: 'Username already taken.' });
        }
        
        // Update username in the global store and rooms
        delete users[username];
        user.username = newUsername;
        users[newUsername] = user;

        // Note: Room and follower/following updates would need to be handled here too in a complex app.
    }
    
    const updatedUser = { 
        ...user, 
        following: Array.from(user.following || []),
        followers: Array.from(user.followers || [])
    };

    res.json({ 
        success: true, 
        message: 'Profile updated successfully.',
        user: updatedUser,
        newPicUrl: user.profilePic // Send new pic URL back
    });
});


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

// Store Items API
app.get('/api/store/items', (req, res) => {
    res.json({ success: true, items: storeItems });
});


// 6. Follow / Unfollow User API 
app.post('/api/user/follow', (req, res) => {
    const { followerUsername, targetUsername, action } = req.body;
    const follower = users[followerUsername];
    const target = users[targetUsername];

    if (!follower || !target) {
        return res.json({ success: false, message: 'User not found.' });
    }
    
    // ... (Follow/Unfollow logic remains the same)
});


// --- Socket.IO Logic ---
io.on('connection', (socket) => {
    // ... (All Socket.IO event listeners: joinRoom, sendMessage, sendGift, setMic, disconnect)
    // The previous comprehensive Socket.IO logic should be fully pasted here. 
    // This section is omitted for brevity in this response but MUST be included in your server.js.
});


// --- Start Server ---
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
                       
