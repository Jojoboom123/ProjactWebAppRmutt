const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
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

router.put('/update-profile', verifyToken, upload.single('image'), userController.updateProfile);
router.get('/joined-rooms', verifyToken, userController.getJoinedRooms);
router.post('/phone', verifyToken, userController.requestChangePhoneOtp);
router.post('/phone-verify', verifyToken, userController.verifyAndUpdatePhoneNumber);
router.put('/radius', verifyToken, userController.updateRadius);
router.put('/change-password', verifyToken, userController.changePassword);
router.put('/fcm-token', verifyToken, userController.updateFcmToken);

module.exports = router;