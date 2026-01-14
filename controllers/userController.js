const mongoose = require('mongoose');
const User = require('../models/User');
const Room = require('../models/Room');
const Otp = require('../models/Otp');
const bcrypt = require('bcryptjs'); 
const otpService = require('../services/otpService');

exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : req.userId;
        const { username } = req.body;
        
        let user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.username = username || user.username;
  
        if (req.file) {
            user.profileImage = `uploads/${req.file.filename}`; 
        }

        await user.save(); 

        res.json({
            success: true,
            message: 'อัปเดตโปรไฟล์สำเร็จ!',
            user: {
                username: user.username,
                phoneNumber: user.phoneNumber,
                profileImage: user.profileImage
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : req.userId;
        const { currentPassword, newPassword ,confirmPassword} = req.body;  
        let user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้งาน' });
        }
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน' });
        }
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save(); 
        res.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จแล้ว!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }  
};

// POST /api/auth/request-change-phone-otp
exports.requestChangePhoneOtp = async (req, res) => {
    try {
        const { newPhoneNumber } = req.body;
        const userId = req.user ? req.user.id : req.userId; // ดึง ID คนที่กำลัง Login อยู่

        // 1. ตรวจสอบว่ามีเบอร์นี้ไหม และต้องเช็คให้ละเอียด
        if (!newPhoneNumber || newPhoneNumber.length < 10) {
            return res.status(400).json({ success: false, message: 'เบอร์โทรศัพท์ไม่ถูกต้อง' });
        }

        // 2. เช็คว่าเบอร์นี้มีคนอื่นใช้ไปหรือยัง
        // (ต้องเช็คว่าไม่ใช่เบอร์ของตัวเอง และไม่ใช่เบอร์ของคนอื่น)
        const existingUser = await User.findOne({ phoneNumber: newPhoneNumber });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'เบอร์โทรศัพท์นี้มีผู้ใช้งานแล้ว' });
        }

        await otpService.sendOtp(newPhoneNumber);

        res.json({ success: true, message: 'ส่ง OTP ไปยังเบอร์ใหม่เรียบร้อยแล้ว' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.verifyAndUpdatePhoneNumber = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : req.userId;
        const { newPhoneNumber, otp } = req.body;

        // 1. ตรวจสอบข้อมูลเบื้องต้น
        if (!newPhoneNumber || !otp) {
            return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
        }

        await otpService.verifyOtp(newPhoneNumber, otp);

        // 3. เช็คอีกรอบเพื่อความชัวร์ว่าเบอร์ไม่ซ้ำ (กันเหนียว)
        const checkDuplicate = await User.findOne({ phoneNumber: newPhoneNumber });
        if (checkDuplicate) {
            return res.status(400).json({ success: false, message: 'เบอร์นี้ถูกใช้งานไปแล้วในระหว่างดำเนินการ' });
        }

        // 4. *** อัปเดตเบอร์โทรศัพท์จริงๆ ตรงนี้ ***
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้งาน' });
        }

        user.phoneNumber = newPhoneNumber;
        await user.save();

        // 5. ลบ OTP ทิ้งเมื่อใช้เสร็จแล้ว
        await Otp.deleteOne({ phoneNumber: newPhoneNumber });

        res.json({
            success: true,
            message: 'เปลี่ยนเบอร์โทรศัพท์สำเร็จ!',
            user: {
                id: user._id,
                phoneNumber: user.phoneNumber,
                username: user.username
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.getJoinedRooms = async (req,res) => {
    try {
       const{ userId} = req.user ? req.user : { userId: req.userId };
    
    // ใช้ Aggregate เพื่อ Join ข้อมูล
    const rooms = await Room.aggregate([
      { $match: { participants: new mongoose.Types.ObjectId(userId) } }, // หาห้องที่มีเรา
      {
        $lookup: { // Join กับตาราง Messages
          from: 'messages',
          let: { roomId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$roomId', '$$roomId'] } } },
            { $sort: { createdAt: -1 } }, // เรียงเอาใหม่สุด
            { $limit: 1 } // เอาแค่อันเดียว
          ],
          as: 'lastMessageData'
        }
      },
      {
        $addFields: {
          lastMessage: { $arrayElemAt: ['$lastMessageData.message', 0] }, // ดึงข้อความออกมา
          lastMessageTime: { $arrayElemAt: ['$lastMessageData.createdAt', 0] } // ดึงเวลาออกมา
        }
      },
      { $project: { lastMessageData: 0 } } // ลบ temp field ออก
    ]);

    res.json({ success: true, data: rooms });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};


exports.updateRadius = async (req, res) => {
    try{
        const userId = req.user ? req.user.id : req.userId;
        const { radius } = req.body;
        let user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }   
        user.radius = radius || user.radius;
        await user.save();
        res.json({ success: true, message: 'อัปเดตระยะทางสำเร็จ!', radius: user.radius }); 
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
        
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

