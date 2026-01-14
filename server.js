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
const app = express();
const PORT = process.env.PORT || 3000;
const verifyToken = require('./middleware/authMiddleware');

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
        console.log("🖼️ ไฟล์รูปภาพ:", req.file);
        
        const createdBy = req.userId;
        const { title, description, activityDate, location, roomType, password } = req.body;

        let parsedLocation = location;
        if (typeof location === 'string') {
            try {
                parsedLocation = JSON.parse(location);
            } catch (e) {
                return res.status(400).json({ message: 'Location format invalid (must be JSON string)' });
            }
        }

        const newRoom = new Room({
            title,
            description,
            activityDate,
            location: parsedLocation,
            createdBy: createdBy,
            roomType,
            participants: [createdBy],
            password: roomType === 'public' ? null : password,
            roomImage: req.file ? 'uploads/' + req.file.filename : "" 
        });
        
        await newRoom.save();
        console.log(`✅ Room Created: ${newRoom.title} (Image: ${newRoom.roomImage})`);
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
            console.log('\n📤 ===== SENDING MESSAGE =====');
            console.log('Data received:', data);

            const { roomId, message, type = 'text' } = data;

            // ตรวจสอบว่ามี user หรือไม่
            if (!socket.user) {
                console.error("❌ No user found in socket - Authentication failed");
                socket.emit('error', { message: 'Authentication error' });
                return;
            }

            // ดึง user ID
            const senderId = socket.user.id || socket.user.userId || socket.user._id;
            const senderName = socket.user.username;

            if (!senderId) {
                console.error("❌ Cannot extract user ID from token");
                socket.emit('error', { message: 'Invalid user data' });
                return;
            }

            console.log(`👤 Sender ID: ${senderId}`);
            console.log(`🏠 Room ID: ${roomId}`);

            // สร้างข้อความใหม่
            const newMessage = new Message({
                roomId,
                sender: senderId,
                message,
                type: type
            });

            await newMessage.save();
            console.log(`✅ Message saved to MongoDB: ${newMessage._id}`);

            // Populate sender information
            const messageData = await newMessage.populate('sender', 'username profilePicture');

            // Broadcast to room (ส่ง Socket ให้คนที่เปิดจออยู่)
            io.to(roomId).emit('receive_message', messageData);
            console.log(`✅ Message broadcast to room ${roomId}`);


            // 1. ดึงข้อมูลห้อง และ "รายชื่อคนในห้อง" (participants)
            const room = await Room.findById(roomId).populate('participants');

            if (room && room.participants) {
                console.log(`👥 สมาชิกในห้องมี: ${room.participants.length} คน (รวมคนส่ง)`);

                // 2. วนลูปเช็คสมาชิกทีละคน
                room.participants.forEach(async (user) => {
                    const userIdStr = user._id.toString();
                    const senderIdStr = senderId.toString();

                    // ไม่ส่งหาตัวเอง
                    if (userIdStr !== senderIdStr) {
                        // A. ยิง Push Notification (เฉพาะคนที่มี Token)
                        if (user.fcmToken) {
                            console.log(`📲 กำลังส่งแจ้งเตือนหา: ${user.username}`);
                            firebaseService.sendPushNotification(
                                user.fcmToken,
                                `ข้อความใหม่จาก ${room.title}`,
                                `${senderName}: ${type === 'image' ? 'ส่งรูปภาพ' : message}`,
                                { roomId: roomId.toString() }
                            ).catch(err => console.error('Push Error:', err.message));
                        }
                        try {
                            await Notification.create({
                                recipient: user._id,
                                sender: senderId,
                                title: `ข้อความใหม่จาก ${room.title}`,
                                body: `${senderName}: ${type === 'image' ? 'ส่งรูปภาพ' : message}`,
                                type: 'new_message',
                                data: { roomId: roomId.toString() }
                            });
                            console.log(`📝 บันทึกแจ้งเตือนให้ ${user.username} แล้ว`);
                        } catch (err) {
                            console.error('Save notification error:', err);
                        }
                    }
                });
            }

            console.log('============================\n');

        } catch (error) {
            console.error("\n❌ ===== ERROR SENDING MESSAGE =====");
            console.error("Error:", error);

            socket.emit('error', {
                message: 'Failed to send message: ' + error.message
            });
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

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 ================================`);
    console.log(`🚀 Server Updated & Running on port ${PORT}`);
    console.log(`🚀 http://localhost:${PORT}`);
    console.log(`🚀 ================================\n`);
});