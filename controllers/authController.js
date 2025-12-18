const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Otp = require('../models/Otp');

const SECRET_KEY = process.env.JWT_SECRET;

// (OTP)
exports.requestOtp = async (req, res) => {
    try {
        const  {phoneNumber}  = req.body;
        console.log('req.body =', req.body);
        console.log('phoneNumber =', phoneNumber);
        if (!phoneNumber) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกเบอร์โทรศัพท์' });
        }

        const existingUser = await User.findOne({ phoneNumber });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'เบอร์โทรศัพท์นี้ลงทะเบียนไปแล้ว' });
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        await Otp.findOneAndUpdate(
            { phoneNumber }, 
            { otp: otpCode, createdAt: Date.now() }, 
            { upsert: true, new: true }
        );
-
        
        console.log(` ส่งไปที่: ${phoneNumber}`);
        console.log(` รหัส OTP คือ:  ${otpCode}  `);
        
        
        res.json({ success: true, message: 'ส่ง OTP (จำลอง) แล้ว ดูรหัสที่หน้าจอ Console' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// (Register)
exports.register = async (req, res) => {
    try {
        
        const { username, phoneNumber, password, confirmPassword, otp } = req.body;// รับค่า otp 
        
        if (!username || !phoneNumber || !password || !confirmPassword || !otp) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'รหัสผ่านไม่ตรงกัน' });
        }

        
        const validOtp = await Otp.findOne({ phoneNumber, otp });
        if (!validOtp) {
            return res.status(400).json({ success: false, message: 'รหัส OTP ไม่ถูกต้อง หรือหมดอายุ' }); //  OTP Database
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

        await Otp.deleteOne({ phoneNumber });

        res.status(201).json({ success: true, message: 'สมัครสมาชิกสำเร็จ!' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
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