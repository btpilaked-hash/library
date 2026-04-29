const mongoose = require("mongoose");

const logLib = new mongoose.Schema({
    lib_id:   { type: mongoose.Schema.Types.ObjectId, ref: "Librarian", required: true },
    time_in:  { type: Date, required: true },
    time_out: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model("LogLibrarian", logLib);