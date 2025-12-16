const Room = require('../models/Room');


exports.createRoom = async (req, res) => {
    try {
        const { title, description, lat, lng, address, activityDate, password } = req.body;

        const newRoom = new Room({
            title,
            description,
            location: { lat, lng, address },
            activityDate,
            password: password || null,
            createdBy: req.userId,
            participants: [req.userId]
        });

        await newRoom.save();
        res.status(201).json({ message: 'สร้างห้องสำเร็จ!', room: newRoom });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error });
    }
};


exports.getAllRooms = async (req, res) => {
    try {

        const rooms = await Room.find()
            .populate('createdBy', 'username firstName profilePicture')
            .populate('participants', 'username firstName profilePicture')
            .sort({ createdAt: -1 });

        res.json(rooms);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};


exports.joinRoom = async (req, res) => {
    try {
        const { roomId, password } = req.body;
        const userId = req.userId;

        const room = await Room.findById(roomId);
        if (!room) return res.status(404).json({ message: 'ไม่พบห้องนี้' });

        if (room.bannedUsers.includes(userId)) {
            return res.status(403).json({ message: 'คุณถูกแบนจากห้องนี้ ไม่สามารถเข้าร่วมได้' });
        }

        if (room.participants.includes(userId)) {
            return res.status(400).json({ message: 'คุณอยู่ในห้องนี้อยู่แล้ว' });
        }


        if (room.password) {

            const isMatch = await room.comparePassword(password);
            if (!isMatch) {
                return res.status(401).json({ message: 'รหัสผ่านเข้าห้องไม่ถูกต้อง' });
            }
        }
        room.participants.push(userId);
        await room.save();

        res.json({ message: 'เข้าร่วมห้องสำเร็จ!', room });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.deleteRoom = async (req, res) => {
    try {
        const { roomId } = req.body;
        const room = await Room.findById(roomId);

        if (!room) return res.status(404).json({ message: 'ไม่พบห้องนี้' });

        if (room.createdBy.toString() !== req.userId) {
            return res.status(403).json({ message: 'คุณไม่ใช่เจ้าของห้องนี้ ลบไม่ได้!' });
        }

        await Room.findByIdAndDelete(roomId);
        res.json({ message: 'ลบห้องเรียบร้อยแล้ว' });

    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

//  (Kick/Ban)
exports.kickUser = async (req, res) => {
    try {
        const { roomId, targetUserId, ban } = req.body;
        const room = await Room.findById(roomId);

        if (!room) return res.status(404).json({ message: 'ไม่พบห้องนี้' });


        if (room.createdBy.toString() !== req.userId) {
            return res.status(403).json({ message: 'คุณไม่ใช่เจ้าของห้อง สั่งเตะใครไม่ได้!' });
        }

        room.participants = room.participants.filter(id => id.toString() !== targetUserId);


        if (ban === true) {
            room.bannedUsers.push(targetUserId);
        }

        await room.save();
        res.json({ message: ban ? 'เตะและแบนสมาชิกเรียบร้อย' : 'เตะสมาชิกเรียบร้อย' });

    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};