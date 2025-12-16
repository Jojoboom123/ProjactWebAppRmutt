const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET;

const verifyToken = (req, res, next) => {
    const tokenHeader = req.headers['authorization'];

    if (!tokenHeader) {
        return res.status(403).json({ message: 'No token provided (ไม่ได้ส่งToken)' });
    }

    const token = tokenHeader.split(' ')[1];

    if (!token) {
        return res.status(403).json({ message: 'Invalid token format' });
    }

   
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Unauthorized (Tokenหมดอายุหรือปลอม)' });
        }

        req.userId = decoded.id;
        req.username = decoded.username;
        next();
    });
};

module.exports = verifyToken;