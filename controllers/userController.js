const User = require('../models/User');
const bcrypt = require('bcryptjs'); 


exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : req.userId;
        const { password, username } = req.body;
        
        let user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (password) {
            user.password = password;
        }
        if (username) {
             user.username = username;
        }
        if (req.file) {
            user.profileImage = req.file.path; 
        }

        await user.save(); 

        res.json({
            success: true,
            message: 'อัปเดตโปรไฟล์สำเร็จ!',
            user: {
                username: user.username,
                phoneNumber: user.phoneNumber,
                profileImage: user.profileImage
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};