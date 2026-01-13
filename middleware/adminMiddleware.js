module.exports = (req, res, next) => {
    // req.user ได้มาจาก verifyToken ที่เราแก้ตะกี้
    if (req.user && req.user.role === 'admin') {
        next(); // เป็นแอดมินจริง -> ผ่านไปได้
    } else {
        res.status(403).json({ 
            success: false, 
            message: 'Access Denied: สำหรับผู้ดูแลระบบเท่านั้น' 
        });
    }
};