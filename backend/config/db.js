const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Replace with your MongoDB URI
        await mongoose.connect('mongodb://127.0.0.1:27017/gatekeeper');
        console.log('MongoDB Connected...');
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

module.exports = connectDB;