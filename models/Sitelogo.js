const mongoose = require("mongoose");

// Stores the student-facing logo as a base64 data URL.
// There is always exactly one document — we upsert by the fixed key "student".
const siteLogoSchema = new mongoose.Schema({
    key:       { type: String, default: "student", unique: true },
    dataUrl:   { type: String, required: true },   // full "data:image/png;base64,..." string
    updatedAt: { type: Date,   default: Date.now },
});

module.exports = mongoose.model("SiteLogo", siteLogoSchema);