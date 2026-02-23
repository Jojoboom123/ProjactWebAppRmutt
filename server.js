const firebaseService = require('./services/firebaseService');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require("socket.io");
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Room = require('./models/Room');
const Message = require('./models/Message');
const roomRoutes = require('./routes/roomRoutes');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const tagRoutes = require('./routes/tagRoutes');
const app = express();
const PORT = process.env.PORT || 3000;

const verifyToken = require('./middleware/authMiddleware');
const Notification = require('./models/Notification');
const notificationRoutes = require('./routes/notificationRoutes');

app.use('/api/notifications', notificationRoutes);
app.use(express.json());
app.use(cors());
app.use('/uploads', express.static('uploads'));

const SECRET_KEY = process.env.JWT_SECRET;

// Multer configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'uploads/';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath);
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, 'room-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ DB Connection Error:', err));

// Routes

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tags', tagRoutes);

app.get('/', (req, res) => {
    res.send('Server is running normally! 🚀');
});
const server = http.createServer(app);
const io = new Server(server, {
    path: "/socket.io",
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true,
    },
    transports: ["websocket"],
});

// Create room endpoint
app.post('/api/create-room', upload.single('roomImage'), verifyToken, async (req, res) => {
    try {
        console.log("📝 ได้รับข้อมูลสร้างห้อง:", req.body);
        
        const createdBy = req.userId;
        
        // 1. ✅ เพิ่มการรับตัวแปร 'tags' เข้ามาด้วย
        const { title, description, activityDate, location, roomType, password, tags } = req.body;

        const userObjectId = new mongoose.Types.ObjectId(createdBy);
        
        // จัดการ Location (แปลง JSON String เป็น Object)
        let parsedLocation = location;
        if (typeof location === 'string') {
            try {
                parsedLocation = JSON.parse(location);
            } catch (e) {
                return res.status(400).json({ message: 'Location format invalid' });
            }
        }

        // 2. ✅ เพิ่มส่วนแปลง Tags (เพราะถ้าส่งมากับรูปภาพ มันจะเป็น String ต้องแปลงเป็น Array)
        let parsedTags = [];
        if (tags) {
            try {
                // ถ้าเป็น String ให้แปลงเป็น JSON, ถ้าเป็น Array อยู่แล้วก็ใช้ได้เลย
                parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
            } catch (e) {
                console.error("Tags parse error:", e);
                parsedTags = []; 
            }
        }

        const newRoom = new Room({
            title,
            description,
            activityDate,
            location: parsedLocation,
            createdBy: createdBy,
            roomType,
            participants: [userObjectId],
            password: roomType === 'public' ? null : password,
            roomImage: req.file ? 'uploads/' + req.file.filename : "",
            Tag: parsedTags 
        });
        
        await newRoom.save();
        console.log(`Room Created: ${newRoom.title} with Tags: ${parsedTags}`);

        io.emit('refresh_room_list'); 
        res.status(201).json({ success: true, message: 'สร้างห้องสำเร็จ', room: newRoom });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ message: 'สร้างห้องไม่สำเร็จ: ' + error.message });
    }
});

io.use((socket, next) => {
    try {
        let token = socket.handshake.auth?.token ||
            socket.handshake.query?.token ||
            socket.handshake.headers?.token;
        if (!token) {
            console.log("❌ Socket Refused: No Token");
            return next(new Error("Authentication error: Token required"));
        }

        if (token.startsWith('Bearer ')) {
            token = token.slice(7);
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;

        console.log(`✅ Socket Authenticated: ${decoded.username || decoded.id}`);
        next();
    } catch (err) {
        console.error("❌ Socket Auth Error:", err.message);
        next(new Error("Authentication error"));
    }
});

// Socket.IO Connection Handler
io.on('connection', (socket) => {
    console.log('\n🔌 ===== NEW SOCKET CONNECTION =====');
    console.log(`📱 Socket ID: ${socket.id}`);
    console.log(`👤 User Data:`, socket.user);
    console.log('=====================================\n');

    // Join room event
    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        console.log(`📥 User ${socket.user.username || socket.user.id} joined room: ${roomId}`);
    });

    // Send message event
   socket.on('send_message', async (data) => {
    try {
        // 1. รับค่า userLocation เพิ่มเข้ามา
        const { roomId, message, type = 'text', userLocation } = data;

        if (!socket.user) return; // หรือส่ง error กลับ
        const senderId = socket.user.id;

        const room = await Room.findById(roomId);
        if (!room) return;

        // 2. 🛡️ BACKEND CHECK: เช็คระยะทางเพื่อความปลอดภัย (กันคนยิง API มั่ว)
        if (room.location && room.location.coordinates && userLocation) {
            const roomLon = room.location.coordinates[0];
            const roomLat = room.location.coordinates[1];
            
            // รับค่าจาก Frontend (ต้องส่งมาเป็น { lat: ..., lng: ... })
            const userLat = userLocation.lat;
            const userLon = userLocation.lng;

            if (userLat && userLon) {
                const distance = getDistanceFromLatLonInKm(userLat, userLon, roomLat, roomLon);
                const MAX_RADIUS_KM = 2.0; // ⛔ กำหนดระยะห้ามเกิน 2 กม.

                if (distance > MAX_RADIUS_KM) {
                    console.log(`❌ User อยู่นอกระยะ (${distance.toFixed(2)} km) - ปฏิเสธข้อความ`);
                    socket.emit('error', { message: 'คุณอยู่นอกพื้นที่กิจกรรม ไม่สามารถส่งข้อความได้' });
                    return; // จบการทำงานทันที
                }
            }
        }

        // 3. ถ้าผ่านเงื่อนไข ก็บันทึกตามปกติ
        const newMessage = new Message({
            roomId,
            sender: senderId,
            message,
            type
        });
        await newMessage.save();

        // Populate ข้อมูลคนส่งเพื่อส่งกลับไปแสดงผลทันที
        await newMessage.populate('sender', 'username profileImage');

        io.to(roomId).emit('receive_message', newMessage);

    } catch (error) {
        console.error(error);
    }
});

    // Delete room event
    socket.on('delete_room', async (data) => {
        const { roomId, ownerId } = data;
        try {
            const room = await Room.findById(roomId);
            if (!room) {
                socket.emit('error', 'ไม่พบห้องนี้ในระบบ');
                return;
            }

            await Room.findByIdAndDelete(roomId);

            if (room.roomImage) {
                const imagePath = path.join(__dirname, 'uploads', room.roomImage);
                if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
            }

            console.log(`✅ Room ${roomId} deleted from DB`);
            io.to(roomId).emit('room_destroyed', 'ห้องนี้ถูกยุบแล้ว');
            io.in(roomId).socketsLeave(roomId);
            io.emit('refresh_room_list');

        } catch (error) {
            console.error('Error deleting room:', error);
            socket.emit('error', 'เกิดข้อผิดพลาดในการลบห้อง');
        }
    });

    // Disconnect event
    socket.on('disconnect', () => {
        console.log(`⚠️ User disconnected: ${socket.id}`);
    });
});

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // รัศมีโลก (km)
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 ================================`);
    console.log(`🚀 Server Updated & Running on port ${PORT}`);
    console.log(`🚀 http://localhost:${PORT}`);
    console.log(`🚀 ================================\n`);
});