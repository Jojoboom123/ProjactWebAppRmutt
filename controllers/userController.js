const User = require('../models/User');
const bcrypt = require('bcryptjs'); 

exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : req.userId;
        const { firstName, lastName, password } = req.body;

        let user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;

        if (password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
        }
  
        if (req.file) {
            user.profilePicture = req.file.path; 
        }

        await user.save(); 

        res.json({
            success: true,
            message: 'อัปเดตโปรไฟล์สำเร็จ!',
            user: {
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                profilePicture: user.profilePicture
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            success: false, 
            message: 'Server Error' 
        });
    }
};