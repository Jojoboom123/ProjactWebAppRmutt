const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Room = require('../models/Room');
const Message = require('../models/Message'); 
const Report = require('../models/Reports'); 
const Tag = require('../models/Tag');

const verifyToken = require('../middleware/authMiddleware');
const verifyAdmin = require('../middleware/adminMiddleware');

const getStartDate = (type) => {
    const now = new Date();
    if (type === 'day') return new Date(now.setHours(0, 0, 0, 0));
    if (type === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
    if (type === 'year') return new Date(now.getFullYear(), 0, 1);
    return new Date(0); // ตลอดกาล
};

//  1. Dashboard API (จัดเต็มทุกสถิติ)
router.get('/dashboard', verifyToken, verifyAdmin, async (req, res) => {
    try {
        // --- 1. ข้อมูลสถิติทั่วไป (เพิ่ม Upcoming Rooms และ Daily Messages) ---
        const [
            dailyUsers, monthlyUsers, yearlyUsers, totalUsers, totalRooms, 
            upcomingRooms,  //  จำนวนห้องที่ "กำลังจะจัดกิจกรรม"
            dailyMessages   //  ปริมาณแชทวันนี้
        ] = await Promise.all([
            User.countDocuments({ createdAt: { $gte: getStartDate('day') } }),
            User.countDocuments({ createdAt: { $gte: getStartDate('month') } }),
            User.countDocuments({ createdAt: { $gte: getStartDate('year') } }),
            User.countDocuments(),
            Room.countDocuments(),
            Room.countDocuments({ activityDate: { $gte: new Date() } }), // 👈 นับเฉพาะห้องที่วันจัดกิจกรรมยังไม่ผ่านไป
            Message.countDocuments({ createdAt: { $gte: getStartDate('day') } }) // 👈 นับแชทของวันนี้
        ]);

        // --- 2. สัดส่วนห้อง Public vs Private
        const roomTypes = await Room.aggregate([
            { $group: { _id: "$roomType", count: { $sum: 1 } } }
        ]);
        // แปลงให้อยู่ในรูปแบบที่หน้าบ้านใช้ง่ายขึ้น
        const roomTypeStats = {
            public: roomTypes.find(r => r._id === 'public')?.count || 0,
            private: roomTypes.find(r => r._id === 'private')?.count || 0
        };

        // --- 3. สถานที่ยอดฮิต (Top 5 Locations)
        const popularLocations = await Room.aggregate([
            { $group: { _id: "$location.name", roomCount: { $sum: 1 } } },
            { $match: { _id: { $ne: null, $ne: "" } } },
            { $sort: { roomCount: -1 } },
            { $limit: 5 }
        ]);

        // --- 4. ช่วงเวลาที่คนแชทเยอะสุด (Peak Hours)
        const peakHours = await Message.aggregate([
            { $project: { hour: { $hour: { date: "$createdAt", timezone: "Asia/Bangkok" } } } },
            { $group: { _id: "$hour", activityCount: { $sum: 1 } } },
            { $sort: { activityCount: -1 } },
            { $limit: 5 }
        ]);

        // --- 5. Tag ยอดฮิต (Top 5 Tags) 
        const popularTags = await Room.aggregate([
            { $unwind: "$tags" },
            { $group: { _id: "$tags", usageCount: { $sum: 1 } } },
            { $sort: { usageCount: -1 } },
            { $limit: 5 },
            {
                $lookup: { from: "tags", localField: "_id", foreignField: "_id", as: "tagInfo" }
            },
            { $unwind: "$tagInfo" },
            { $project: { _id: 0, tagId: "$_id", name: "$tagInfo.name", usageCount: 1 } }
        ]);

        // ส่งข้อมูลทั้งหมดกลับไปให้หน้าบ้าน
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
                    total: totalRooms,
                    upcoming: upcomingRooms, //  ส่งจำนวนกิจกรรมที่กำลังจะเกิด
                    types: roomTypeStats     //  ส่งสัดส่วน Public/Private
                },
                messages: {
                    today: dailyMessages     //  ส่งปริมาณแชทวันนี้
                },
                topLocations: popularLocations, 
                peakHours: peakHours,           
                topTags: popularTags            
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

//  2. ระบบจัดการผู้ใช้และห้องแชท (Users & Rooms)
router.get('/users', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

router.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'ลบผู้ใช้สำเร็จ' });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

router.get('/rooms', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const rooms = await Room.find().populate('createdBy', 'username');
        res.json(rooms);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

router.delete('/rooms/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        await Room.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'ลบห้องสำเร็จ' });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

//  3. ระบบจัดการคำร้องเรียน (Reports)

router.get('/reports', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const reports = await Report.find()
            .populate('roomId', 'title roomImage')
            .populate('reportedUser', 'username profileImage')
            .populate('reporterUser', 'username profileImage')
            .populate('messageId', 'message type')
            .sort({ createdAt: -1 });
        res.json({ success: true, count: reports.length, data: reports });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

router.put('/reports/:id/status', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { status } = req.body; 
        if (!['pending', 'resolved', 'dismissed'].includes(status)) {
            return res.status(400).json({ success: false, message: 'สถานะไม่ถูกต้อง' });
        }
        const report = await Report.findByIdAndUpdate(req.params.id, { status: status }, { new: true });
        if (!report) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูล Report' });
        res.json({ success: true, message: `เปลี่ยนสถานะเป็น ${status} เรียบร้อยแล้ว`, data: report });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

//  4. ระบบจัดการ Tag (หมวดหมู่ห้อง) สำหรับ Admin
router.post('/tags', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อ Tag' });
        const newTag = new Tag({ name });
        await newTag.save();
        res.status(201).json({ success: true, message: 'สร้าง Tag สำเร็จ', data: newTag });
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ success: false, message: 'ชื่อ Tag นี้มีอยู่แล้ว' });
        res.status(500).json({ message: error.message });
    }
});

router.put('/tags/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อ Tag ใหม่' });
        const updatedTag = await Tag.findByIdAndUpdate(req.params.id, { name }, { new: true });
        if (!updatedTag) return res.status(404).json({ success: false, message: 'ไม่พบ Tag นี้' });
        res.json({ success: true, message: 'แก้ไขสำเร็จ', data: updatedTag });
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ success: false, message: 'ชื่อ Tag นี้มีอยู่แล้ว' });
        res.status(500).json({ message: error.message });
    }
});

router.delete('/tags/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const deletedTag = await Tag.findByIdAndDelete(req.params.id);
        if (!deletedTag) return res.status(404).json({ success: false, message: 'ไม่พบ Tag นี้' });
        res.json({ success: true, message: 'ลบ Tag สำเร็จ' });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

module.exports = router;