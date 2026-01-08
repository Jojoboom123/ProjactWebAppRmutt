const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const verifyToken = require('../middleware/authMiddleware'); 
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {

        cb(null, 'room-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });


router.get('/', roomController.getAllRooms);

// แก้ไขห้อง
router.put('/update/:roomId', verifyToken, upload.single('roomImage'), roomController.updateRoom);

router.post('/upload-chat-image', verifyToken, upload.single('chatImage'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'กรุณาเลือกไฟล์รูปภาพ' });
        }
        // ส่งชื่อไฟล์กลับไปให้หน้าบ้าน เพื่อเอาไปแนบใน Socket
        res.json({ success: true, imageFilename: req.file.filename });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Upload Error' });
    }
});

// เข้าร่วมห้อง
router.post('/:roomId/join-public', verifyToken, roomController.joinPublicRoom);
router.post('/:roomId/join-private', verifyToken, roomController.joinPrivateRoom);

// จัดการห้อง (ลบ, ดูข้อมูล, เตะคน)
router.delete('/delete', verifyToken, roomController.deleteRoom);
router.post('/information', verifyToken, roomController.getRoomInformation);
router.post('/kick', verifyToken, roomController.kickUser);

// ดูข้อความในห้อง
router.get('/:roomId/messages', verifyToken, roomController.getRoomMessages);

module.exports = router;