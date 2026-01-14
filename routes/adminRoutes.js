// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Room = require('../models/Room');
const verifyToken = require('../middleware/authMiddleware');
const verifyAdmin = require('../middleware/adminMiddleware');

// ✅ ฟังก์ชันช่วยคำนวณวันเริ่มต้น
const getStartDate = (type) => {
    const now = new Date();
    if (type === 'day') return new Date(now.setHours(0, 0, 0, 0));
    if (type === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
    if (type === 'year') return new Date(now.getFullYear(), 0, 1);
    return new Date(0); // ตลอดกาล
};

// 1. 📊 Dashboard API (ดูภาพรวม รายวัน/เดือน/ปี)
router.get('/dashboard', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const [dailyUsers, monthlyUsers, yearlyUsers, totalUsers, totalRooms] = await Promise.all([
            User.countDocuments({ createdAt: { $gte: getStartDate('day') } }),
            User.countDocuments({ createdAt: { $gte: getStartDate('month') } }),
            User.countDocuments({ createdAt: { $gte: getStartDate('year') } }),
            User.countDocuments(),
            Room.countDocuments() // นับจำนวนห้องทั้งหมด
        ]);

        res.json({
            success: true,
            stats: {
                users: {
                    today: dailyUsers,
                    thisMonth: monthlyUsers,
                    thisYear: yearlyUsers,
                    total: totalUsers
                },
                rooms: {
                    total: totalRooms
                }
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 2. 👥 ดูข้อมูล User ทั้งหมด
router.get('/users', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 3. 🗑️ ลบ User
router.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'ลบผู้ใช้สำเร็จ' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 4. 🏠 ดูห้องแชททั้งหมด
router.get('/rooms', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const rooms = await Room.find().populate('createdBy', 'username');
        res.json(rooms);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 5. 🗑️ ลบห้องแชท
router.delete('/rooms/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        await Room.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'ลบห้องสำเร็จ' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;