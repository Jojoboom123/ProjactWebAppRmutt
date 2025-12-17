const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const SECRET_KEY = process.env.JWT_SECRET;

// (Register)
exports.register = async (req, res) => {
    try {
        const { username, phoneNumber, password, confirmPassword } = req.body;
        
        if (!username || !phoneNumber || !password || !confirmPassword) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'รหัสผ่านไม่ตรงกัน' });
        }

        const existingPhone = await User.findOne({ phoneNumber });
        if (existingPhone) {
            return res.status(400).json({ success: false, message: 'เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว' });
        }

        const newUser = new User({ 
            username, 
            password, 
            phoneNumber
        });

        await newUser.save(); 

        res.status(201).json({ success: true, message: 'สมัครสมาชิกสำเร็จ!' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// (Login)
exports.login = async (req, res) => {
    try {
        const { phoneNumber, password } = req.body;

        if (!phoneNumber || !password) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกเบอร์โทรศัพท์และรหัสผ่าน' });
        }

        const user = await User.findOne({ phoneNumber });
        if (!user) {
            return res.status(400).json({ success: false, message: 'เบอร์โทรศัพท์หรือรหัสผ่านไม่ถูกต้อง' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'เบอร์โทรศัพท์หรือรหัสผ่านไม่ถูกต้อง' });
        }

        const token = jwt.sign({ id: user._id, username: user.username }, SECRET_KEY, { expiresIn: '1d' });
        
        res.json({ 
            success: true,
            message: 'เข้าสู่ระบบสำเร็จ', 
            token,
            user: { 
                id: user._id,
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