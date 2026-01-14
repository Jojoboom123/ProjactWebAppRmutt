const Notification = require('../models/Notification');

// 1. 📥 ดึงรายการแจ้งเตือนทั้งหมดของผู้ใช้ (เรียงใหม่สุดก่อน)
exports.getUserNotifications = async (req, res) => {
    try {
        const userId = req.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        // ดึงข้อมูล
        const notifications = await Notification.find({ recipient: userId })
            .populate('sender', 'username profilePicture') // ดึงชื่อ/รูปคนส่งมาโชว์ด้วย
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // นับจำนวนที่ยังไม่ได้อ่าน
        const unreadCount = await Notification.countDocuments({
            recipient: userId,
            isRead: false
        });

        res.status(200).json({
            success: true,
            count: notifications.length,
            unreadCount,
            data: notifications
        });

    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 2. 👀 กดอ่านแจ้งเตือน (ทีละอัน)
exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;

        const notification = await Notification.findOneAndUpdate(
            { _id: id, recipient: req.userId }, // ต้องเป็นของตัวเองเท่านั้นถึงมีสิทธิ์แก้
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ success: false, message: 'ไม่พบการแจ้งเตือน' });
        }

        res.status(200).json({ success: true, data: notification });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 3. ✅ กด "อ่านทั้งหมด" (Mark All as Read)
exports.markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { recipient: req.userId, isRead: false },
            { isRead: true }
        );

        res.status(200).json({ success: true, message: 'อ่านทั้งหมดเรียบร้อย' });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// 4. 🗑️ ลบการแจ้งเตือน
exports.deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;

        const deleted = await Notification.findOneAndDelete({
            _id: id,
            recipient: req.userId
        });

        if (!deleted) {
            return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลหรือคุณไม่มีสิทธิ์ลบ' });
        }

        res.status(200).json({ success: true, message: 'ลบเรียบร้อย' });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};