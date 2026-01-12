const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const verifyToken = require('../middleware/authMiddleware'); 
const multer = require('multer');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); 
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });
router.get('/', roomController.getAllRooms);

router.post('/:roomId/join-public', verifyToken, roomController.joinPublicRoom);
router.post('/:roomId/join-private', verifyToken, roomController.joinPrivateRoom);

router.delete('/delete', verifyToken, roomController.deleteRoom);
router.post('/information', verifyToken, roomController.getRoomInformation);
router.post('/kick', verifyToken, roomController.kickUser);

router.get('/:roomId/messages', verifyToken, roomController.getRoomMessages);
router.get('/:roomId/lastest', verifyToken, roomController.getLastestMessage);

router.post('/:roomId/leave', verifyToken, roomController.leaveRoom);
router.post('/:roomId/report', verifyToken, roomController.reportMessage);
router.post('/upload', verifyToken, upload.single('image'), roomController.uploadImage);
module.exports = router;