const mongoose = require('mongoose');
const request_detail = new mongoose.Schema({
    stu_id:          { type: String, required: true },
    student_name:    { type: String, required: true },
    yearAndSection:  { type: String, required: true },
    isbn:         { type: String, required: true },
    book_title:      { type: String, required: true },
    status: {
        type: String,
        enum: ["Pending","Accepted","PickedUp","Declined","Returned","Lost","Cancelled"],
        default: "Pending"
    },
    request_time:    { type: Date, default: Date.now },
    responded_time:  { type: Date, default: null },  // accepted/declined time
    pickedup_time:   { type: Date, default: null },  // when picked up
    returned_time:   { type: Date, default: null },  // when returned or lost
    remarks:         { type: String, default: null },
    book_condition:  { type: String, default: null },
    responded_by_id:   { type: String, default: null },
    responded_by_name: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.models.request || mongoose.model("request", request_detail);