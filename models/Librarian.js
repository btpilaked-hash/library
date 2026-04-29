const mongoose = require('mongoose');

const librarian = new mongoose.Schema({
    lib_id:    { type: String, required: true, trim: true, unique: true },
    fName:     { type: String, required: true },
    mName:     { type: String, required: true },
    lName:     { type: String, required: true },
    cNumber:   { type: String, required: true },
    unp_email: { type: String, required: true },
    pin:       { type: String, required: true, trim: true },
    status:    { type: String, enum: ["active", "hold"], default: "active" },
    picture:   { type: String, default: null },   // path: /uploadLib/filename.jpg
}, { timestamps: true });

module.exports = mongoose.model("Librarian", librarian);