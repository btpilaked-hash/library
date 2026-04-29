const Book      = require("../models/shelf_a");
const Student   = require("../models/Student");
const Librarian = require("../models/Librarian");
const { signToken } = require("../middleware/auth");

// ── Student Login ──────────────────────────────────────
const logS = async (req, res) => {
    try {
        const { stu_id, pin } = req.body;
        if (!stu_id || !pin) return res.status(400).json({ message: "Student ID and Pin are required" });

        const stu = await Student.findOne({ stu_id, pin });
        if (!stu) return res.status(401).json({ message: "Invalid Student credentials" });

        const token = signToken({ id: stu._id, role: "student", stu_id: stu.stu_id });
        res.json({ message: "Student logged successfully", token });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ── Librarian Login ────────────────────────────────────
const logL = async (req, res) => {
    try {
        const { lib_id, pin } = req.body;
        if (!lib_id || !pin) return res.status(400).json({ message: "Librarian ID and PIN are required" });

        const lib = await Librarian.findOne({ lib_id, pin });
        if (!lib) return res.status(401).json({ message: "Invalid Librarian Credentials" });

        if (lib.status === "hold") {
            return res.status(403).json({ message: "Your account is on hold. Please contact the admin." });
        }

        const token = signToken({ id: lib._id, role: "librarian", lib_id: lib.lib_id });
        res.json({ message: "Librarian logged successfully", token });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ── Student Register ───────────────────────────────────
const regS = async (req, res) => {
    try {
        const { pin, stu_id, fName, lName, mName, yearAndSection } = req.body;
        if (!pin || !stu_id || !fName || !lName || !mName || !yearAndSection) {
            return res.status(400).json({ message: "All fields are required" });
        }
        if (!/^\d{1,6}$/.test(pin)) {
            return res.status(400).json({ message: "PIN must be up to 6 digits (numbers only)" });
        }
        const exist = await Student.findOne({ stu_id });
        if (exist) return res.status(409).json({ message: `Student ID "${stu_id}" is already taken` });

        const student   = await Student.create({ pin, stu_id, fName, lName, mName, yearAndSection });
        const stu_token = signToken({ id: student._id, role: "student", stu_id: student.stu_id });
        res.status(201).json({ message: "Student Registered Successfully", stu_token, Student: student });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ── Librarian Register (supports optional picture upload) ─────────────────
// Called from librarianR.js which runs multer first — picture in req.file
const regL = async (req, res) => {
    try {
        const { lib_id, fName, mName, lName, cNumber, unp_email, pin } = req.body;
        if (!lib_id || !fName || !mName || !lName || !cNumber || !unp_email || !pin) {
            return res.status(400).json({ message: "All fields are required" });
        }
        if (!/^\d{1,6}$/.test(pin)) {
            return res.status(400).json({ message: "PIN must be up to 6 digits (numbers only)" });
        }
        const exist = await Librarian.findOne({ lib_id });
        if (exist) return res.status(409).json({ message: `Librarian ID "${lib_id}" is already taken` });

        // Picture path — stored as /uploadLib/filename.ext
        const picture = req.file ? req.file.path : null;

        const newL  = await Librarian.create({ lib_id, fName, mName, lName, cNumber, unp_email, pin, picture });
        const token = signToken({ id: newL._id, role: "librarian", lib_id: newL.lib_id });
        res.status(201).json({ message: "Librarian Registered Successfully", token, Librarian: newL });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { logS, logL, regS, regL };