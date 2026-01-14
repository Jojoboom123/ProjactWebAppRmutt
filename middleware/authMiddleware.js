const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET;

const verifyToken = (req, res, next) => {
    const tokenHeader = req.headers['authorization'];

    if (!tokenHeader) {
        return res.status(403).json({ 
            success: false, 
            message: 'No token provided (ไม่ได้ส่ง Token)' 
        });
    }

    const token = tokenHeader.split(' ')[1];

    if (!token) {
        return res.status(403).json({ 
            success: false, 
            message: 'Invalid token format' 
        });
    }

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).json({ 
                success: false, 
                message: 'Unauthorized (Token หมดอายุหรือปลอม)' 
            });
        }

        // ✅ แก้ไขตรงนี้: เก็บข้อมูลทั้งหมด (รวมถึง role) ไว้ใน req.user
        req.user = decoded; 
        
        // (เก็บอันเก่าไว้ด้วย เผื่อโค้ดอื่นเรียกใช้)
        req.userId = decoded.id; 
        req.username = decoded.username;
        
        next();
    });
};

module.exports = verifyToken;