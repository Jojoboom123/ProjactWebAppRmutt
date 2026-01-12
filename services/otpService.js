const Otp = require('../models/Otp');
const axios = require('axios'); 

exports.sendOtp = async (phoneNumber) => {
    
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  
    await Otp.findOneAndUpdate(
        { phoneNumber: phoneNumber },
        { 
            otp: otpCode, 
            expiresAt: expiresAt,
            createdAt: Date.now() // เพื่อให้ TTL ทำงานถ้าใช้ Mongo Index
        },
        { upsert: true, new: true }
    );

    // ส่ง SMS ผ่าน Third Party (ส่วนนี้แล้วแต่เจ้าที่ใช้)
    // await sendSmsViaThirdParty(phoneNumber, otpCode);
    
    // สำหรับ Dev/Test ให้ log ดูใน console แทน
    console.log(`[OTP Service] ส่งไปที่ ${phoneNumber} รหัส: ${otpCode}`);

    return true; // ส่งกลับไปบอกว่าสำเร็จ
};

// ฟังก์ชันตรวจสอบ OTP
exports.verifyOtp = async (phoneNumber, code) => {
    // ค้นหา OTP จากเบอร์โทร
    const record = await Otp.findOne({ phoneNumber: phoneNumber });

    // เช็คว่าเจอไหม
    if (!record) return { valid: false, message: "ไม่พบข้อมูล OTP หรือรหัสหมดอายุแล้ว" };

    // เช็คว่ารหัสตรงกันไหม
    if (record.otp !== code) return { valid: false, message: "รหัส OTP ไม่ถูกต้อง" };

    // เช็คว่าหมดอายุหรือยัง (ถ้าไม่ได้ใช้ TTL ของ Mongo)
    if (record.expiresAt < Date.now()) return { valid: false, message: "รหัส OTP หมดอายุแล้ว" };

    // ถ้าถูกต้อง -> ลบ OTP ทิ้งทันที (ป้องกันการใช้ซ้ำ)
    await Otp.deleteOne({ phoneNumber: phoneNumber });

    return { valid: true };
};