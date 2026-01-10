const Room = require('../models/Room');
const Message = require('../models/Message'); 
const bcrypt = require('bcryptjs'); 

// 1. สร้างห้อง
exports.createRoom = async (req, res) => {
    try {
        const { title, description, lat, lng, address, activityDate, password, roomType, maxParticipants } = req.body;

        if (!title || !lat || !lng || !activityDate) {
             return res.status(400).json({ 
                 success: false, 
                 message: 'กรุณากรอกข้อมูลให้ครบ (ชื่อห้อง, พิกัด, วันเวลานัดหมาย)' 
             });
        }

        const newRoom = new Room({
            title,
            description,
            location: { 
                type: 'Point', 
                coordinates: [parseFloat(lng), parseFloat(lat)], 
                address: address 
            },
            activityDate,
            password: password || null, 
            roomType: roomType || 'public',
            maxParticipants: maxParticipants || 10, 
            createdBy: req.userId,
            participants: [req.userId],
            roomImage: req.file ? req.file.filename : "" 
        });

        await newRoom.save();
        
        res.status(201).json({ 
            success: true, 
            message: 'สร้างห้องสำเร็จ!', 
            room: newRoom 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// 2. ดึงห้องทั้งหมด
exports.getAllRooms = async (req, res) => {
    try {
        let { lat, lng, radius } = req.query;
        let rooms;

        if (lat && lng && radius) {
            const userLat = parseFloat(lat);
            const userLng = parseFloat(lng);
            const searchRadius = parseFloat(radius) * 1000; 

            rooms = await Room.aggregate([
                {
                    $geoNear: {
                        near: { type: "Point", coordinates: [userLng, userLat] },
                        distanceField: "distanceFromMe", 
                        maxDistance: searchRadius,
                        spherical: true,
                        distanceMultiplier: 1 
                    }
                },
                { $sort: { distanceFromMe: 1 } }
            ]);
            
            await Room.populate(rooms, { path: 'createdBy', select: 'username firstName profilePicture' });
            await Room.populate(rooms, { path: 'participants', select: 'username firstName profilePicture' });

        } else {
            rooms = await Room.find({})
                .populate('createdBy', 'username firstName profilePicture')
                .populate('participants', 'username firstName profilePicture')
                .sort({ createdAt: -1 })
                .lean();
        }

        res.status(200).json({ success: true, count: rooms.length, data: rooms });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// 3. เข้าห้อง Public
exports.joinPublicRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        const userId = req.userId;

        const room = await Room.findById(roomId);
        if (!room) return res.status(404).json({ success: false, message: 'ไม่พบห้องนี้' });

        if (room.roomType !== 'public') {
            return res.status(400).json({ success: false, message: 'ห้องนี้เป็น Private' });
        }

        if (room.bannedUsers.includes(userId)) return res.status(403).json({ message: 'คุณถูกแบน' });
        if (room.participants.includes(userId)) return res.status(400).json({ message: 'อยู่แล้ว' });
        if (room.participants.length >= room.maxParticipants) return res.status(400).json({ message: 'ห้องเต็ม' });

        room.participants.push(userId);
        await room.save();

        res.json({ success: true, message: 'เข้าร่วมห้องสำเร็จ!', room });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 4. เข้าห้อง Private
exports.joinPrivateRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { password } = req.body;
        const userId = req.userId;

        if (!password) return res.status(400).json({ success: false, message: 'กรุณากรอกรหัสผ่าน' });

        const room = await Room.findById(roomId);
        if (!room) return res.status(404).json({ success: false, message: 'ไม่พบห้องนี้' });

        if (room.roomType !== 'private') return res.status(400).json({ success: false, message: 'ห้องนี้เป็น Public' });

        const isMatch = await bcrypt.compare(password, room.password);
        if (!isMatch) return res.status(401).json({ success: false, message: 'รหัสผ่านผิด' });

        if (room.bannedUsers.some(id => id.toString() === userId)) return res.status(403).json({ message: 'คุณถูกแบน' });
        if (room.participants.some(id => id.toString() === userId)) return res.status(400).json({ message: 'อยู่แล้ว' });
        if (room.participants.length >= room.maxParticipants) return res.status(400).json({ message: 'ห้องเต็ม' });

        room.participants.push(userId);
        await room.save();

        res.json({ success: true, message: 'เข้าร่วมห้องสำเร็จ!', room });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 5. ลบห้อง
exports.deleteRoom = async (req, res) => {
    try {
        const { roomId } = req.body;
        const room = await Room.findById(roomId);

        if (!room) return res.status(404).json({ success: false, message: 'ไม่พบห้องนี้' });

        if (room.createdBy.toString() !== req.userId) {
            return res.status(403).json({ success: false, message: 'คุณไม่ใช่เจ้าของห้อง' });
        }

        await Room.findByIdAndDelete(roomId);
        res.json({ success: true, message: 'ลบห้องเรียบร้อยแล้ว' });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 6. ดูข้อมูลห้อง
exports.getRoomInformation = async (req, res) => {
    try {
        const { roomId } = req.body;
        if (!roomId) return res.status(400).json({ success: false, message: 'Please provide roomId' });

        const room = await Room.findById(roomId)
            .populate('createdBy', 'username firstName lastName profilePicture') 
            .populate('participants', 'username');

        if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

        res.status(200).json({ success: true, data: room });

    } catch (error) {
        console.error(error);
        if (error.kind === 'ObjectId') return res.status(400).json({ success: false, message: 'Invalid Room ID format' });
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 7. เตะสมาชิก
exports.kickUser = async (req, res) => {
    try {
        const { roomId, targetUserId, ban } = req.body; 
        const room = await Room.findById(roomId);

        if (!room) return res.status(404).json({ success: false, message: 'ไม่พบห้องนี้' });
        
        if (room.createdBy.toString() !== req.userId) {
            return res.status(403).json({ success: false, message: 'คุณไม่ใช่เจ้าของห้อง' });
        }

        room.participants = room.participants.filter(id => id.toString() !== targetUserId);
       
        if (ban === true) {
            room.bannedUsers.push(targetUserId);
        }

        await room.save();
        res.json({ success: true, message: ban ? 'เตะและแบนสมาชิกเรียบร้อย' : 'เตะสมาชิกเรียบร้อย' });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 8. ดูข้อความแชท
exports.getRoomMessages = async (req, res) => {
    try {
        const { roomId } = req.params;
        const messages = await Message.find({ roomId })
            .populate('sender', 'username firstName profilePicture') 
            .sort({ timestamp: 1 }); 

        res.json({ success: true, data: messages });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
}; // ✅ ปิดฟังก์ชัน getRoomMessages ตรงนี้สำคัญมาก!

// 9. แก้ไขห้อง (Update Room)
exports.updateRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { title, description, activityDate, maxParticipants, roomType, password } = req.body;
        
        let room = await Room.findById(roomId);
        
        if (!room) return res.status(404).json({ success: false, message: 'ไม่พบห้องนี้' });

        if (room.createdBy.toString() !== req.userId) {
            return res.status(403).json({ success: false, message: 'คุณไม่ใช่เจ้าของห้อง' });
        }

        if (title) room.title = title;
        if (description) room.description = description;
        if (activityDate) room.activityDate = activityDate;
        if (maxParticipants) room.maxParticipants = maxParticipants;
        if (roomType) room.roomType = roomType;

        if (password && room.roomType === 'private') {
            room.password = password; 
        } else if (roomType === 'public') {
            room.password = null; 
        }

        if (req.file) {
            room.roomImage = req.file.filename;
        }

        await room.save();
        res.json({ success: true, message: 'แก้ไขข้อมูลห้องสำเร็จ!', room });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
}; // ✅ ปิดฟังก์ชัน updateRoom (จบไฟล์)