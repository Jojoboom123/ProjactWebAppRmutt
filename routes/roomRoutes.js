const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const verifyToken = require('../middleware/authMiddleware');

router.post('/create', verifyToken, roomController.createRoom);
router.get('/', roomController.getAllRooms);
router.post('/join', verifyToken, roomController.joinRoom);// เข้าร่วมห้อง 
router.delete('/delete', verifyToken, roomController.deleteRoom);
router.post('/kick', verifyToken, roomController.kickUser);// เตะ/แบนสมาชิก 

module.exports = router;