const Room = require('../models/Room');
const Message = require('../models/Message'); 
const bcrypt = require('bcryptjs'); 
const Report = require('../models/Reports');

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

        let rooms;

        if (lat && lng && radius) {
           
            const userLat = parseFloat(lat);
            const userLng = parseFloat(lng);
            const searchRadius = parseFloat(radius) * 1000; 

            rooms = await Room.aggregate([
                {
                    $geoNear: {
                        near: { type: "Point", coordinates: [userLng, userLat] },
                        distanceField: "distanceFromMe", //สำหรับบอกระยะห่างห้องถ้าส่งพิกัดมา
                        maxDistance: searchRadius,
                        spherical: true,
                        distanceMultiplier: 1 
                    }
                },
                {
                    $sort: { distanceFromMe: 1 } 
                }
            ]);

            
            await Room.populate(rooms, { path: 'createdBy', select: 'username firstName profilePicture' });
            await Room.populate(rooms, { path: 'participants', select: 'username firstName profilePicture' });

        } else {
            //สำหรับค้นหาห้องทั้งหมดถ้าไม่ส่งพิกัดมา
            rooms = await Room.find({})
                .populate('createdBy', 'username firstName profilePicture')
                .populate('participants', 'username firstName profilePicture')
                .sort({ createdAt: -1 })
                .lean();
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
        if (room.participants.includes(userId)) return res.status(200).json({ success: true, message: 'อยู่แล้ว' });
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

        // ✅ เช็ค password ก่อน
        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'กรุณากรอกรหัสผ่าน'
            });
        }

        // ✅ ต้องประกาศ room ก่อนใช้งาน
        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบห้องนี้'
            });
        }

        if (room.roomType !== 'private') {
            return res.status(400).json({
                success: false,
                message: 'ห้องนี้เป็น Public'
            });
        }

        const isMatch = await bcrypt.compare(password, room.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'รหัสผ่านผิด'
            });
        }

        if (room.bannedUsers.some(id => id.toString() === userId)) {
            return res.status(403).json({ message: 'คุณถูกแบน' });
        }

        if (room.participants.some(id => id.toString() === userId)) {
            return res.status(200).json({ success: true, message: 'อยู่แล้ว' });
        }

        if (room.participants.length >= room.maxParticipants) {
            return res.status(400).json({ message: 'ห้องเต็ม' });
        }

        room.participants.push(userId);
        await room.save();

        res.json({
            success: true,
            message: 'เข้าร่วมห้องสำเร็จ!',
            room
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
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
            .populate('participants', 'username profileImage');

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
        const { limit = 50, skip = 0 } = req.query; 

        console.log(`📥 Fetching messages for room: ${roomId}`);

        // ดึงข้อความจาก DB โดยเรียงตามเวลา (เก่า -> ใหม่)
        const messages = await Message.find({ roomId })
            .populate('sender', 'username profilePicture') 
            .sort({ createdAt: 1 }) // เรียงจากเก่าไปใหม่
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        console.log(`✅ Found ${messages.length} messages`);

        res.json({
            success: true,
            count: messages.length,
            messages
        });

    } catch (error) {
        console.error('❌ Error fetching messages:', error);
        res.status(500).json({
            success: false,
            message: 'ไม่สามารถดึงข้อความได้: ' + error.message
        });
    }
};

exports.getLastestMessage = async (req, res) => {
     try {
        const { roomId } = req.params;
        const { before } = req.query; // Timestamp ของข้อความก่อนหน้า

        let query = { roomId };
        
        // ถ้ามี before (เอาไว้โหลดข้อความเก่าขึ้นไป)
        if (before) {
            query.createdAt = { $lt: new Date(before) };
        }

        const messages = await Message.find(query)
            .populate('sender', 'username profilePicture')
            .sort({ createdAt: -1 }) // เรียงจากใหม่ไปเก่า
            .limit(20);

        res.json({
            success: true,
            count: messages.length,
            messages: messages.reverse() 
        });

    } catch (error) {
        console.error('❌ Error fetching latest messages:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

exports.leaveRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        const userId = req.userId;

        console.log(`🚪 User ${userId} is attempting to leave room ${roomId}`);
        const room = await Room.findById(roomId);

        if (!room) return res.status(404).json({ success: false, message: 'ไม่พบห้องนี้' });    
        room.participants = room.participants.filter(id => id.toString() !== userId);
        await room.save();

        res.json({ success: true, message: 'ออกจากห้องเรียบร้อยแล้ว' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }   
};

exports.reportMessage = async (req, res) => { {
    try {
        const { roomId } = req.params;
        const {  messageId, reportedUserId, reason } = req.body;
        const reporterId = req.userId;
        if (!roomId || !messageId || !reportedUserId || !reason) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
        }   
        const newReport = new Report({
            roomId,
            messageId,
            reportedUser: reportedUserId,
            reporterUser: reporterId,
            reason
        });
        await newReport.save();
        res.status(201).json({ success: true, message: 'รายงานถูกส่งเรียบร้อยแล้ว' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }   
}};

exports.uploadImage = async (req,res) =>{
    try{
        if(!req.file){
            return res.status(400).json({seccess: false, message: 'No file upload'});
        }

        const filePath = `uploads/${req.file.filename}`;

        res.status(200).json({
            success: true,
            message: 'Upload successful',
            imageUrl: filePath
        });
    }catch (error) {
        console.error("Upload Error:", error);
        res.status(500).json({ success: false, message: 'Upload failed' });
    }
};
exports.getUserProfile = async (req, res) => {
    try {
        // req.user.id มาจาก verifyToken
        const userId = req.user ? req.user.id : req.userId;
        const user = await User.findById(userId).select('-password'); // ไม่ส่ง password กลับไป

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            user: user
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
exports.updateRoom = async (req, res) => {
    try {
        const roomId = req.params.id;
        const userId = req.user ? req.user.id : req.userId; // ไอดีคนกดแก้ไข
        
        // 1. รับค่าที่ส่งมา
        const { title, description, password, roomType, location } = req.body;

        // 2. หาห้องก่อน
        let room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({ success: false, message: 'ไม่พบห้องแชท' });
        }

        // 3. 🛡️ เช็คสิทธิ์ 
        if (room.createdBy.toString() !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์แก้ไขห้องนี้ (ต้องเป็นเจ้าของห้อง)' });
        }

        // 4. อัปเดตข้อมูล (ถ้ามีการส่งค่ามาใหม่ ก็ใช้ค่าใหม่ ถ้าไม่ส่งมา ก็ใช้ค่าเดิม)
        room.title = title || room.title;
        room.description = description || room.description;
        room.roomType = roomType || room.roomType;

        // จัดการรหัสผ่าน 
        if (roomType === 'public') {
            room.password = undefined; // หรือ ""
        } else if (password) {
            // ถ้าส่งรหัสมาใหม่ ก็อัปเดต )
            room.password = password; 
        }

        // 5. จัดการ Location (ตำแหน่ง)
        if (location) {
            if (typeof location === 'string') {
                try {
                    room.location = JSON.parse(location);
                } catch (e) {
                    console.error("Location parse error:", e);
                    
                }
            } else {
                room.location = location;
            }
        }

        // 6. จัดการรูปภาพ (ถ้ามีการอัปโหลดรูปใหม่มา)
        if (req.file) {
            if (room.roomImage && room.roomImage !== "") {
                const oldPath = path.join(__dirname, '../', room.roomImage); 
                
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }
            // ใส่รูปใหม่
            room.roomImage = `uploads/${req.file.filename}`;
        }

        // 7. บันทึก
        await room.save();

        res.json({
            success: true,
            message: 'แก้ไขห้องสำเร็จ',
            room: room
        });

    } catch (error) {
        console.error("Update Room Error:", error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.getRoomReports = async (req, res) => {
    try {
        const { roomId } = req.params;
        const userId = req.userId; // ได้มาจาก verifyToken

        // 1. หาห้องก่อน เพื่อเช็คว่าเป็นเจ้าของจริงไหม
        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({ success: false, message: 'ไม่พบห้องแชท' });
        }

        // 2. เช็ค: คนเรียก api เป็น "เจ้าของห้อง" หรือไม่?
        if (room.owner.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'คุณไม่ใช่เจ้าของห้องนี้ ไม่มีสิทธิ์ดูรายงาน' });
        }

        // 3. ดึง Report ทั้งหมดของห้องนี้
        const reports = await Report.find({ roomId: roomId })
            .select('-status -__v') // ✂️ ตัด status และ __v ทิ้งตามที่ขอ
            .populate('reportedUser', 'username profileImage') // ดึงรูป/ชื่อ คนโดนรีพอร์ต
            .populate('reporterUser', 'username profileImage') // ดึงรูป/ชื่อ คนแจ้ง
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: reports.length,
            data: reports
        });

    } catch (error) {
        console.error('Error fetching room reports:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
}