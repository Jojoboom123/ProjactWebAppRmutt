const Otp = require('../models/Otp');
const axios = require('axios'); 

// ฟังก์ชันส่ง OTP
exports.sendOtp = async (phoneNumber) => {
    
    // สร้างรหัส 6 หลัก
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // กำหนดวันหมดอายุ 5 นาที
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // บันทึกลง Database (Upsert: ถ้ามีให้แก้ ถ้าไม่มีให้สร้าง)
    await Otp.findOneAndUpdate(
        { phoneNumber: phoneNumber },
        { 
            otp: otpCode, 
            expiresAt: expiresAt,
            createdAt: Date.now() 
        },
        { upsert: true, new: true }
    );

    // Log ดูรหัส (เพราะเราไม่ได้ต่อ SMS จริง)
    console.log(`[OTP Service] ส่งไปที่ ${phoneNumber} รหัส: ${otpCode}`);

    return true; 
};

// ฟังก์ชันตรวจสอบ OTP
exports.verifyOtp = async (phoneNumber, code) => {
    // ค้นหา OTP จากเบอร์โทร
    const record = await Otp.findOne({ phoneNumber: phoneNumber });

    // 1. เช็คว่าเจอ record ไหม
    if (!record) return { valid: false, message: "ไม่พบข้อมูล OTP หรือรหัสหมดอายุแล้ว" };

    // 2. เช็คว่ารหัสตรงกันไหม
    if (record.otp !== code) return { valid: false, message: "รหัส OTP ไม่ถูกต้อง" };

    // 3. เช็คว่าหมดอายุหรือยัง (กันเหนียว)
    if (record.expiresAt < Date.now()) return { valid: false, message: "รหัส OTP หมดอายุแล้ว" };

    // ถ้าถูกต้อง -> ลบ OTP ทิ้งทันที (ป้องกันการใช้ซ้ำ)
    await Otp.deleteOne({ phoneNumber: phoneNumber });

    return { valid: true };
};