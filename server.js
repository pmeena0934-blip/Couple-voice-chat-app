const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Simple in-memory database
let users = {};
let rooms = {};
let roomIdCounter = 10000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to prevent Render server from sleeping (Pinging itself)
app.get('/keep-alive', (req, res) => {
    console.log('Keep-alive ping received.');
    res.status(200).send('Server is awake');
});

// --- API Endpoints ---

// 1. Login/Register Endpoint
app.post('/api/login', (req, res) => {
    const { username } = req.body;
    
    if (!username) {
        return res.status(400).json({ success: false, message: 'Username is required.' });
    }

    if (users[username]) {
        // Login successful
        console.log(`User logged in: ${username}`);
        return res.json({ 
            success: true, 
            message: 'Login successful.', 
            user: users[username] 
        });
    } else {
        // Register new user
        const newUser = {
            username: username,
            id: Math.floor(Math.random() * 9000000) + 1000000,
            diamonds: 50, // Initial balance
            coins: 100,
            level: 1,
            followers: 0,
            following: 0,
            visitors: 0
        };
        users[username] = newUser;
        console.log(`New user registered: ${username}`);
        return res.json({ 
            success: true, 
            message: 'Registration successful.', 
            user: newUser 
        });
    }
});

// 2. Create Room Endpoint
app.post('/api/create-room', (req, res) => {
    const { roomName, isVip, username } = req.body;

    if (!roomName || !username) {
        return res.status(400).json({ success: false, message: 'Room name and username are required.' });
    }
    
    // Simple room creation logic
    const user = users[username];
    if (!user) {
        return res.status(401).json({ success: false, message: 'User not logged in.' });
    }

    // Check diamond balance for VIP room (if needed)
    if (isVip && user.diamonds < 30) {
        return res.status(402).json({ success: false, message: 'Insufficient diamonds for VIP Room.' });
    }

    const newRoom = {
        id: roomIdCounter++,
        name: roomName,
        owner: username,
        isVip: isVip,
        members: [username],
        currentMembers: 1,
        maxMembers: 16,
        diamondsCost: isVip ? 30 : 0,
        createdAt: new Date().toISOString()
    };
    
    // Deduct diamonds for VIP room
    if (isVip) {
        user.diamonds -= 30;
    }

    rooms[newRoom.id] = newRoom;
    console.log(`Room created: ${newRoom.name} by ${username}`);
    
    return res.json({ 
        success: true, 
        message: 'Room created successfully.', 
        room: newRoom 
    });
});

// 3. Get Rooms List Endpoint
app.get('/api/rooms', (req, res) => {
    // Convert rooms object to array for easier consumption
    const roomList = Object.values(rooms).map(room => ({
        id: room.id,
        name: room.name,
        owner: room.owner,
        isVip: room.isVip,
        currentMembers: room.currentMembers
    }));
    
    // Add some dummy rooms if none exist to avoid empty screen
    if (roomList.length === 0) {
        roomList.push(
            { id: 10001, name: 'Welcome Room (Public)', owner: 'System', isVip: false, currentMembers: 15 },
            { id: 10002, name: 'Royal Voice Party', owner: 'Ava', isVip: true, currentMembers: 8 },
            { id: 10003, name: 'Chill Chat Zone', owner: 'Guest', isVip: false, currentMembers: 4 }
        );
    }
    
    console.log(`Serving ${roomList.length} rooms.`);
    res.json({ success: true, rooms: roomList });
});

// Serve static files (HTML, CSS, JS) from the 'public' folder
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Fallback for all other requests to index.html (useful for client-side routing)
app.get('*', (req, res) => {
    // Only send the file if the request is for an HTML page, not for a file that doesn't exist
    if (!req.url.includes('.')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
            
