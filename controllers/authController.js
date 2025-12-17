const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const SECRET_KEY = process.env.JWT_SECRET;

// (Register)
exports.register = async (req, res) => {
    try {
        const { username, password, firstName, lastName, phoneNumber } = req.body;
        
        if (!username || !password || !firstName || !lastName || !phoneNumber) {
            return res.status(400).json({ success: false, message: 'Please fill in all fields (กรุณากรอกข้อมูลให้ครบถ้วน)' });
        }

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
      
        const newUser = new User({ 
            username, 
            password: hashedPassword, 
            firstName,
            lastName,
            phoneNumber
        });

        await newUser.save(); 

        res.status(201).json({ success: true, message: 'User registered successfully!' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
// (Login)
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please provide username and password' 
            });
        }

        const user = await User.findOne({ username });
        
        if (!user) {
            return res.status(400).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }

        const token = jwt.sign({ id: user._id, username: user.username }, SECRET_KEY, { expiresIn: '1d' });
        
        res.json({ 
            success: true,
            message: 'Login successful', 
            token,
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