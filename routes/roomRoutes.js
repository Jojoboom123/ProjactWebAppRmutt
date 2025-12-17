const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const verifyToken = require('../middleware/authMiddleware'); 

router.post('/create', verifyToken, roomController.createRoom);
router.get('/', roomController.getAllRooms);

router.post('/:roomId/join-public', verifyToken, roomController.joinPublicRoom);
router.post('/:roomId/join-private', verifyToken, roomController.joinPrivateRoom);

router.delete('/delete', verifyToken, roomController.deleteRoom);
router.post('/kick', verifyToken, roomController.kickUser);

router.get('/:roomId/messages', verifyToken, roomController.getRoomMessages);

module.exports = router;