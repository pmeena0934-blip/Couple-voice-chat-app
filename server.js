// server.js (Complete File - FINAL CODE)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// --- Import Models ---
const User = require('./models/User'); 
const Transaction = require('./models/Transaction'); // Ensure you have this model
const Gift = require('./models/Gift'); // Ensure you have this model
const Room = require('./models/Room'); // Ensure you have this model

// --- Import Routes (if you have them, e.g., walletRoutes) ---
const walletRoutes = require('./routes/wallet'); // Ensure routes/wallet.js exists if you keep this

// --- Initial Gift Data Setup Function ---
async function setupInitialGifts() {
    const GiftModel = mongoose.models.Gift || require('./models/Gift'); 
    
    const defaultGifts = [
        { name: 'Rose', diamondCost: 10, category: 'Small', imageUrl: 'images/rose.png' },
        { name: 'Super Rocket', diamondCost: 50000, category: 'SuperGift', imageUrl: 'images/rocket.png', isSuperGift: true },
    ];
    for (const gift of defaultGifts) {
        await GiftModel.updateOne({ name: gift.name }, gift, { upsert: true });
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
    setupInitialGifts(); 
  })
  .catch(err => {
    console.error('MongoDB Atlas Connection Error:', err);
    process.exit(1); 
  });

// --- API Routes ---
app.use('/api/wallet', walletRoutes); // Assuming this file exists


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

// ********** GET ALL ROOMS API **********
app.get('/api/rooms', async (req, res) => {
    try {
        // Find all rooms, sorted by creation time
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

// --- Other API Routes (Profile Edit, Buy Diamonds, Admin Approval, Get Gifts) will go here ---
// ... (For brevity, excluding other previously discussed API routes)
// *******************************************************************************************


// ********** STATICS AND WILDCARD ROUTE (FIX for 404 on rooms.html) **********
app.get('*', (req, res) => {
    // If the request path includes a file extension (e.g., .html, .css, .js), try to serve it from 'public'
    if (req.path.includes('.')) {
        res.sendFile(path.join(__dirname, 'public', req.path));
    } 
    // Otherwise, assume it's the root path and serve index.html
    else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});
// ****************************************************************************

// --- Socket.io Logic ---
// ... (Socket.io code remains the same)
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    // ... (rest of the socket logic)
});


const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}. Frontend available`));
                                  
