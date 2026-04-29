const mongoose = require('mongoose');
const shelf = new mongoose.Schema({
    title:            { type: String, required: true },
    author:           { type: String, required: true },
    isbn:             { type: String },
    total_copies:     { type: Number, required: true },
    available_copies: { type: Number, required: true },
    category:         { type: String, enum: ["Academic","Non-Academic"], required: true },
    genre:            { type: String, required: true },
    publisher:        { type: String, required: true },
    publish_year:     { type: Date, required: true },
    image:            { type: String, required: true },
    condition_note:   { type: String, default: null },

    added_by_id:    { type: String, default: null },
    added_by_name:  { type: String, default: null },
    edited_by_id:   { type: String, default: null },
    edited_by_name: { type: String, default: null },
    edited_at:      { type: Date,   default: null },
    edited_field:   { type: String, default: null }, // one-word label of what changed
}, { timestamps: true });

module.exports = mongoose.model("shelf_a", shelf);