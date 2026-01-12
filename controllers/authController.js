const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Otp = require('../models/Otp');
const otpService = require('../services/otpService');
const otpService = require('../services/otpService');

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

        // const existingUser = await User.findOne({ phoneNumber });
        // if (existingUser) {
        //     return res.status(400).json({ success: false, message: 'เบอร์โทรศัพท์นี้ลงทะเบียนไปแล้ว' });
        // }

        await otpService.sendOtp(phoneNumber);
        
        
        res.json({ success: true, message: 'ส่ง OTP (จำลอง) แล้ว ดูรหัสที่หน้าจอ Console' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// (Register)
exports.register = async (req, res) => {
    try {
        const { username, phoneNumber, password, confirmPassword, otp } = req.body; // รับค่า otp 
        
        if (!username || !phoneNumber || !password || !confirmPassword || !otp) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'รหัสผ่านไม่ตรงกัน' });
        }

        // ✅ แก้ไขตรงนี้: เหลือการตรวจสอบแค่รอบเดียว
        const otpValidation = await otpService.verifyOtp(phoneNumber, otp);
        if (!otpValidation.valid) {
            return res.status(400).json({ success: false, message: otpValidation.message });
        }

        const existingPhone = await User.findOne({ phoneNumber });
        if (existingPhone) {
            return res.status(400).json({ success: false, message: 'เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว' });
        }

        const newUser = new User({ 
            username, 
            password, 
            phoneNumber,
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
                profileImage: user.profileImage,
                radius: user.radius,
                profileImage: user.profileImage,
                radius: user.radius
            }
        });

    } catch (error) {
        console.error(error); 
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.checkPhoneNumber = async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        
        if (!phoneNumber) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกเบอร์โทรศัพท์' });
        }

        const user = await User.findOne({ phoneNumber });

        if (user) {
            // กรณีเจอ User: ส่ง 200 OK + exists: true
            return res.status(200).json({ 
                success: true, 
                exists: true, 
                message: 'พบเบอร์โทรศัพท์ในระบบ' 
            });
        } else {
            // กรณีไม่เจอ User: ส่ง 200 OK + exists: false
            return res.status(200).json({ 
                success: true, 
                exists: false, 
                message: 'ไม่พบเบอร์โทรศัพท์ในระบบ' 
            });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { phoneNumber, newPassword, confirmPassword} = req.body;
        if (!phoneNumber || !newPassword || !confirmPassword) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'รหัสผ่านไม่ตรงกัน' });
        }
        
        const user = await User.findOne({ phoneNumber });
        if (!user) {
            return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้งาน' });
        }  
        user.password = newPassword;

        await user.save();      
        
        res.json({ success: true, message: 'รีเซ็ตรหัสผ่านสำเร็จ!' });
    }   catch (error) { 
        console.error(error);
        console.error(error); 
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.checkPhoneNumber = async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        
        if (!phoneNumber) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกเบอร์โทรศัพท์' });
        }

        const user = await User.findOne({ phoneNumber });

        if (user) {
            // กรณีเจอ User: ส่ง 200 OK + exists: true
            return res.status(200).json({ 
                success: true, 
                exists: true, 
                message: 'พบเบอร์โทรศัพท์ในระบบ' 
            });
        } else {
            // กรณีไม่เจอ User: ส่ง 200 OK + exists: false
            return res.status(200).json({ 
                success: true, 
                exists: false, 
                message: 'ไม่พบเบอร์โทรศัพท์ในระบบ' 
            });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { phoneNumber, newPassword, confirmPassword} = req.body;
        if (!phoneNumber || !newPassword || !confirmPassword) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'รหัสผ่านไม่ตรงกัน' });
        }
        
        const user = await User.findOne({ phoneNumber });
        if (!user) {
            return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้งาน' });
        }  
        user.password = newPassword;

        await user.save();      
        
        res.json({ success: true, message: 'รีเซ็ตรหัสผ่านสำเร็จ!' });
    }   catch (error) { 
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });    
    }   
};