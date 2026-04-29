const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
    isbn:  { type: String, required: true },
    mongo_id: { type: String, required: true },
    title:    { type: String, required: true },
    author:   { type: String, required: true },
    genre:    { type: String, required: true },
}, { _id: false });

const searchLogSchema = new mongoose.Schema({
    term:        { type: String, required: true },
    searched_at: { type: Date, default: Date.now },
}, { _id: false });

const student = new mongoose.Schema({
    pin:            { type: String, required: true, trim: true },
    stu_id:         { type: String, unique: true, required: true, trim: true },
    fName:          { type: String, required: true },
    lName:          { type: String, required: true },
    mName:          { type: String, required: true },
    yearAndSection: { type: String, required: true },
    status:         { type: String, enum: ["active", "hold"], default: "active" },
    favorites:      { type: [favoriteSchema], default: [] },
    search_log:     { type: [searchLogSchema], default: [] },

    // Audit — who registered/updated this student
    registered_by_id:   { type: String, default: null },  // null = Admin
    registered_by_name: { type: String, default: null },
    updated_by_id:      { type: String, default: null },
    updated_by_name:    { type: String, default: null },
    updated_at:         { type: Date,   default: null },
    updated_field:      { type: String, default: null },  // one-word label of what changed
}, { timestamps: true });

module.exports = mongoose.model("Student", student);