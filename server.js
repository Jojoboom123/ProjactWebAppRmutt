require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require("socket.io");
const multer = require('multer'); 
const path = require('path');
const fs = require('fs');
const Room = require('./models/Room');
const Message = require('./models/Message');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());
app.use('/uploads', express.static('uploads'));

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

const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ DB Connection Error:', err));

const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

const roomRoutes = require('./routes/roomRoutes');
app.use('/api/rooms', roomRoutes);

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});


app.post('/api/create-room', upload.single('roomImage'), verifyToken,async (req, res) => {
    try {
        console.log("📝 ได้รับข้อมูลสร้างห้อง:", req.body);
        console.log("🖼️ ไฟล์รูปภาพ:", req.file);

        const { title, description, activityDate, location, createdBy, roomType, password } = req.body;

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
            createdBy,
            roomType,
            password: roomType === 'public' ? null : password,
            
            roomImage: req.file ? 'uploads/' + req.file.filename : "" 
        });

       await newRoom.save();

        console.log(`✅ Room Created: ${newRoom.title} (Image: ${newRoom.roomImage})`);

        io.emit('refresh_room_list'); 

        res.status(201).json({ message: 'สร้างห้องสำเร็จ', room: newRoom });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ message: 'สร้างห้องไม่สำเร็จ: ' + error.message });
    }
});

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);
    });
    socket.on('send_message', async (data) => {
        try {
            const { roomId, senderId, message } = data;

            const newMessage = new Message({
                roomId,
                sender: senderId,
                message
            });
            await newMessage.save();

            const messageData = await newMessage.populate('sender', 'username firstName profilePicture');

            io.to(roomId).emit('receive_message', messageData);
            console.log(`📩 Message in room ${roomId}: ${message}`);

        } catch (error) {
            console.error("Error sending message:", error);
        }
     });
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

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
});