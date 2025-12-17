const Room = require('../models/Room');
const Message = require('../models/Message'); 
const bcrypt = require('bcryptjs'); 

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
        res.status(500).json({ 
            success: false, 
            message: 'Server Error', 
            error: error.message 
        });
    }
};


exports.getAllRooms = async (req, res) => {
    try {
        let { lat, lng, radius } = req.query;
        let query = {};

        if (lat && lng && radius) {
            const userLat = parseFloat(lat);
            const userLng = parseFloat(lng);
            const searchRadius = parseFloat(radius) * 1000;

            query.location = {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [userLng, userLat]
                    },
                    $maxDistance: searchRadius
                }
            };
        }

        let rooms = await Room.find(query)
            .populate('createdBy', 'username firstName profilePicture')
            .populate('participants', 'username firstName profilePicture')
            .lean(); 

        
        if (!lat || !lng) {
            rooms.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        res.status(200).json({ 
            success: true, 
            count: rooms.length, 
            data: rooms 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            success: false, 
            message: 'Server Error', 
            error: error.message 
        });
    }
};


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

exports.joinPrivateRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { password } = req.body; 
        const userId = req.userId;
        const room = await Room.findById(roomId);
        if (!room) return res.status(404).json({ success: false, message: 'ไม่พบห้องนี้' });

        if (room.roomType !== 'private') {
            return res.status(400).json({ success: false, message: 'ห้องนี้เป็น Public' });
        }

        
        const isMatch = await bcrypt.compare(password, room.password);
        if (!isMatch) return res.status(401).json({ success: false, message: 'รหัสผ่านผิด' });

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
exports.getRoomInformation = async (req, res) => {
    try {
  
        const { roomId } = req.body;

        if (!roomId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please provide roomId in the body' 
            });
        }

        const room = await Room.findById(roomId)
            .populate('createdBy', 'username firstName lastName profilePicture') 
            .populate('participants', 'username');

        if (!room) {
            return res.status(404).json({ 
                success: false, 
                message: 'Room not found' 
            });
        }

        res.status(200).json({
            success: true,
            data: room
        });

    } catch (error) {
        console.error(error);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ success: false, message: 'Invalid Room ID format' });
        }
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

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
        res.json({ 
            success: true, 
            message: ban ? 'เตะและแบนสมาชิกเรียบร้อย' : 'เตะสมาชิกเรียบร้อย' 
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.getRoomMessages = async (req, res) => {
    try {
        const { roomId } = req.params;

        const messages = await Message.find({ roomId })
            .populate('sender', 'username firstName profilePicture') 
            .sort({ timestamp: 1 }); 

        res.json({ 
            success: true, 
            data: messages 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};