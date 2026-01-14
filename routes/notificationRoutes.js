const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/', notificationController.getUserNotifications); // ดึงทั้งหมด
router.put('/read-all', notificationController.markAllAsRead); // อ่านทั้งหมด
router.put('/:id/read', notificationController.markAsRead); // อ่านทีละอัน
router.delete('/:id', notificationController.deleteNotification); // ลบ

module.exports = router;