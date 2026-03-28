const express = require('express');
const router = express.Router();
const Tag = require('../models/Tag');

router.get('/', async (req, res) => {
    try {
        const tags = await Tag.find().sort({ name: 1 }); 
        res.json({ success: true, count: tags.length, data: tags });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

module.exports = router;