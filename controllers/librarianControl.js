const Librarian    = require("../models/Librarian");
const Student      = require("../models/Student");
const Book         = require("../models/shelf_a");
const Request      = require("../models/request");
const LogLibrarian = require("../models/logLibrarian");

// ── Helper ─────────────────────────────────────────────────────────────────
async function getLibInfo(userId) {
    const lib = await Librarian.findById(userId);
    return {
        lib_id:   lib ? lib.lib_id : null,
        lib_name: lib ? `${lib.lName}, ${lib.fName} ${lib.mName}` : "Unknown",
        lib_doc:  lib,
    };
}

// ── Own Profile ────────────────────────────────────────────────────────────
const ownAccLib = async (req, res) => {
    try {
        const lib = await Librarian.findById(req.user.id).select("-pin");
        if (!lib) return res.status(404).json({ message: "Librarian not found" });
        res.json(lib);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── All Requests ───────────────────────────────────────────────────────────
const getReqBooks = async (req, res) => {
    try {
        const requests = await Request.find().sort({ request_time: -1 });
        res.json(requests);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── Accept or Decline ──────────────────────────────────────────────────────
const accept_or_decline_book = async (req, res) => {
    try {

        const { id }     = req.params;
        const { status, remarks } = req.body;

        if (!["Accepted","Declined"].includes(status))
            return res.status(400).json({ message: "Status must be Accepted or Declined" });

        const request = await Request.findById(id);
        if (!request)                     return res.status(404).json({ message: "Request not found" });
        if (request.status !== "Pending") return res.status(400).json({ message: "Request is no longer pending" });

        const { lib_id, lib_name } = await getLibInfo(req.user.id);

        if (status === "Accepted") {
            const book = await Book.findOne({ isbn: request.isbn });
            if (!book || book.available_copies < 1)
                return res.status(400).json({ message: "Book no longer available" });
            await Book.findOneAndUpdate(
                { isbn: request.isbn },
                { $inc: { available_copies: -1 } }
            );
        }

        const updated = await Request.findByIdAndUpdate(id, {
            status,
            remarks:           remarks || null,
            responded_time:    new Date(),
            responded_by_id:   lib_id,
            responded_by_name: lib_name,
        }, { returnDocument: 'after' });

        res.json({ message: `Request ${status}`, request: updated });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── Mark Picked Up ─────────────────────────────────────────────────────────
const markPickedUp = async (req, res) => {
    try {
        const request = await Request.findById(req.params.id);
        if (!request)                      return res.status(404).json({ message: "Request not found" });
        if (request.status !== "Accepted") return res.status(400).json({ message: "Book must be Accepted first" });

        const { lib_id, lib_name } = await getLibInfo(req.user.id);
        const updated = await Request.findByIdAndUpdate(req.params.id, {
            status: "PickedUp",
            responded_time:    new Date(),
            responded_by_id:   lib_id,
            responded_by_name: lib_name,
        }, { returnDocument: 'after' });

        res.json({ message: "Book marked as picked up", request: updated });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── Mark Returned (with condition) ─────────────────────────────────────────
const markReturned = async (req, res) => {
    try {
        const { condition, remarks } = req.body;
        const request = await Request.findById(req.params.id);
        if (!request)                       return res.status(404).json({ message: "Request not found" });
        if (request.status !== "PickedUp")  return res.status(400).json({ message: "Book must be Picked Up first" });

        const { lib_id, lib_name } = await getLibInfo(req.user.id);

        // Restore copy + update condition note on book
        await Book.findOneAndUpdate(
            { isbn: request.isbn },
            {
                $inc: { available_copies: 1 },
                ...(condition ? { condition_note: condition } : {}),
            }
        );

        const updated = await Request.findByIdAndUpdate(req.params.id, {
            status:          "Returned",
            book_condition:  condition || null,
            remarks:         remarks   || null,
            responded_time:  new Date(),
            responded_by_id:   lib_id,
            responded_by_name: lib_name,
        }, { returnDocument: 'after' });

        res.json({ message: "Book returned successfully", request: updated });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── Mark Lost ──────────────────────────────────────────────────────────────
const markLost = async (req, res) => {
    try {
        const request = await Request.findById(req.params.id);
        if (!request)                      return res.status(404).json({ message: "Request not found" });
        if (request.status !== "PickedUp") return res.status(400).json({ message: "Book must be Picked Up to mark Lost" });

        const { lib_id, lib_name } = await getLibInfo(req.user.id);

        // Reduce total_copies permanently (lost = gone)
        await Book.findOneAndUpdate(
            { isbn: request.isbn },
            { $inc: { total_copies: -1 }, condition_note: "Lost" }
        );

        const updated = await Request.findByIdAndUpdate(req.params.id, {
            status:          "Lost",
            book_condition: "Lost",
            responded_time:  new Date(),
            responded_by_id:   lib_id,
            responded_by_name: lib_name,
        }, { returnDocument: 'after' });

        await Student.findOneAndUpdate(
            {stu_id: request.stu_id},
            {status: "hold"}
        );

        res.json({ message: "Book marked as lost. Student account has been put on hold", request: updated });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── Shift: Time In ─────────────────────────────────────────────────────────
const shiftIn = async (req, res) => {
    try {
        // Check if already on shift (no time_out yet)
        const open = await LogLibrarian.findOne({ lib_id: req.user.id, time_out: null });
        if (open) return res.status(400).json({ message: "You already have an open shift. Time out first." });

        const log = await LogLibrarian.create({ lib_id: req.user.id, time_in: new Date() });
        res.json({ message: "Time-in recorded.", log });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── Shift: Time Out ────────────────────────────────────────────────────────
const shiftOut = async (req, res) => {
    try {
        const open = await LogLibrarian.findOne({ lib_id: req.user.id, time_out: null });
        if (!open) return res.status(400).json({ message: "No open shift found. Time in first." });

        const now      = new Date();
        const diffMs   = now - open.time_in;
        const totalMin = Math.floor(diffMs / 60000);
        const hrs      = Math.floor(totalMin / 60);
        const mins     = totalMin % 60;
        const duration = hrs > 0
            ? `${hrs} hr${hrs > 1 ? "s" : ""} ${mins} min${mins !== 1 ? "s" : ""}`
            : `${mins} min${mins !== 1 ? "s" : ""}`;

        open.time_out = now;
        await open.save();

        res.json({ message: `Shift ended. Duration: ${duration}`, duration, log: open });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── My Shifts ──────────────────────────────────────────────────────────────
const myShifts = async (req, res) => {
    try {
        const logs = await LogLibrarian.find({ lib_id: req.user.id }).sort({ time_in: -1 }).limit(30);
        res.json(logs);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── View All Students ──────────────────────────────────────────────────────
const getAllStudents = async (req, res) => {
    try {
        const students = await Student.find().sort({ lName: 1 });
        res.json(students);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── Update Book ────────────────────────────────────────────────────────────
const updateBook = async (req, res) => {
    try {
        const { lib_id, lib_name } = await getLibInfo(req.user.id);
        const fields = { ...req.body, edited_by_id: lib_id, edited_by_name: lib_name, edited_at: new Date() };
        const book   = await Book.findByIdAndUpdate(req.params.id, fields, { returnDocument: 'after' });
        if (!book) return res.status(404).json({ message: "Book not found" });
        res.json({ message: "Book updated", book });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── Get Book by ISBN ───────────────────────────────────────────────────────
const getBookByISBN = async (req, res) => {
    try {
        const book = await Book.findOne({ isbn: req.params.isbn });
        if (!book) return res.status(404).json({ message: "Not found" });
        res.json(book);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── Update Student Info (librarian) ───────────────────────────────────────
// Librarian can edit student name, yearAndSection, pin.
// Auto-updates open requests to keep student_name and yearAndSection fresh.
const updateStudent = async (req, res) => {
    try {
        const { fName, mName, lName, yearAndSection, pin } = req.body;
        const fields = {};
        if (fName)          fields.fName          = fName;
        if (mName)          fields.mName          = mName;
        if (lName)          fields.lName          = lName;
        if (yearAndSection) fields.yearAndSection = yearAndSection;
        if (pin) {
            if (!/^\d{1,6}$/.test(pin))
                return res.status(400).json({ message: "PIN must be up to 6 digits (numbers only)" });
            fields.pin = pin;
        }

        const { lib_id, lib_name } = await getLibInfo(req.user.id);
        fields.updated_by_id   = lib_id;
        fields.updated_by_name = lib_name;
        fields.updated_at      = new Date();

        const updated = await Student.findByIdAndUpdate(req.params.id, fields, { new: true });
        if (!updated) return res.status(404).json({ message: "Student not found" });

        // Auto-update open requests so the request view shows fresh student info
        const newName = `${updated.lName}, ${updated.fName} ${updated.mName}`;
        await Request.updateMany(
            {
                stu_id: updated.stu_id,
                status: { $in: ["Pending", "Accepted", "PickedUp"] }
            },
            {
                student_name:   newName,
                yearAndSection: updated.yearAndSection
            }
        );

        res.json({ message: "Student updated", student: updated });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

module.exports = {
    ownAccLib, getReqBooks,
    accept_or_decline_book, markPickedUp, markReturned, markLost,
    shiftIn, shiftOut, myShifts,
    getAllStudents, updateStudent, updateBook, getBookByISBN,
};