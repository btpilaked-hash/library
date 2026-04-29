const mongoose = require('mongoose');
const conDB = async ()=>{
    try{
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Database connected successfully.");

    }catch(err){
        console.error('MongoDB connection error: ', err.message);
        process.exit(1);
    }
}
module.exports = conDB;