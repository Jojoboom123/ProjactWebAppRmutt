const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    firstName: { type: String, default: "" },  
    lastName: { type: String, default: "" },   
    phoneNumber: { type: String, default: "" }, 
    gender: { type: String, default: "" },
    profilePicture: { type: String, default: "" }
});

module.exports = mongoose.model('User', userSchema);