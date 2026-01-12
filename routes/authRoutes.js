const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
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
router.post('/request-otp', authController.requestOtp);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.put('/update-profile', verifyToken, upload.single('image'), userController.updateProfile);
router.post('/phone-validate', authController.checkPhoneNumber);
router.put('/reset-password',  authController.resetPassword);

module.exports = router;