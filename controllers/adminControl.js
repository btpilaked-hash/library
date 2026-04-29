const Student   = require("../models/Student");
const Librarian = require("../models/Librarian");
const Request   = require("../models/request");
const Book      = require("../models/shelf_a");

// ═══════════════════════════════════════════════════════
//  TRANSACTIONS — excludes Cancelled
// ═══════════════════════════════════════════════════════
const getAllTransactions = async (req, res) => {
    try {
        const transactions = await Request.find(
            { status: { $ne: "Cancelled" } }   // never show student-cancelled requests
        ).sort({ request_time: -1 });
        res.json(transactions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ═══════════════════════════════════════════════════════
//  ACTIVITY LOG
//  category=books (default) | students | requests
// ═══════════════════════════════════════════════════════
const getActivityLog = async (req, res) => {
    try {
        const category = (req.query.category || "books").toLowerCase();
        const log = [];

        // ── BOOKS ──────────────────────────────────────────────
        // Columns: Action | Librarian ID/Admin | Updated | Book Title | Genre | Time Added | Time Updated
        if (category === "books") {
            const books = await Book.find().sort({ createdAt: -1 });

            books.forEach(book => {
                // Row for when the book was first added
                log.push({
                    action:       "Added",
                    lib_id:       book.added_by_id   || "ADMIN",
                    updated:      "",                             // nothing updated on add
                    book_title:   book.title,
                    genre:        book.genre || "—",
                    time_added:   book.createdAt,
                    time_updated: book.edited_at || null,
                });

                // If it was also edited, add a separate Edited row
                if (book.edited_by_id || book.edited_at) {
                    log.push({
                        action:       "Edited",
                        lib_id:       book.edited_by_id  || "ADMIN",
                        updated:      book.edited_field   || "—",
                        book_title:   book.title,
                        genre:        book.genre || "—",
                        time_added:   book.createdAt,
                        time_updated: book.edited_at,
                    });
                }
            });

            // Sort: edited rows by edited_at, added rows by createdAt — newest first
            log.sort((a, b) => {
                const ta = a.action === "Edited" ? new Date(a.time_updated) : new Date(a.time_added);
                const tb = b.action === "Edited" ? new Date(b.time_updated) : new Date(b.time_added);
                return tb - ta;
            });

            // ── STUDENTS ────────────────────────────────────────────
            // Columns: Action | Librarian ID/Admin | Updated | Student ID | Time Added | Time Updated
        } else if (category === "students") {
            const students = await Student.find().sort({ createdAt: -1 });

            students.forEach(stu => {
                // Added row
                log.push({
                    action:       "Added",
                    lib_id:       stu.registered_by_id || "ADMIN",
                    updated:      "",
                    stu_id:       stu.stu_id,
                    time_added:   stu.createdAt,
                    time_updated: stu.updated_at || null,
                });

                // Updated row (only if student was actually updated)
                if (stu.updated_at) {
                    log.push({
                        action:       "Updated",
                        lib_id:       stu.updated_by_id || "ADMIN",
                        updated:      stu.updated_field || "—",
                        stu_id:       stu.stu_id,
                        time_added:   stu.createdAt,
                        time_updated: stu.updated_at,
                    });
                }
            });

            log.sort((a, b) => {
                const ta = a.action === "Updated" ? new Date(a.time_updated) : new Date(a.time_added);
                const tb = b.action === "Updated" ? new Date(b.time_updated) : new Date(b.time_added);
                return tb - ta;
            });

            // ── REQUESTS ────────────────────────────────────────────
            // Columns: Action | Librarian ID | Book ID | Condition | Requested Time | Responded Time | Returned Time
        } else if (category === "requests") {
            const ACTED = ["Accepted","Declined","PickedUp","Returned","Lost"];
            const requests = await Request.find(
                { status: { $in: ACTED } }
            ).sort({ responded_time: -1 });

            // Action labels — no "Marked" prefix
            const actionLabel = {
                Accepted: "Accepted",
                Declined: "Declined",
                PickedUp: "Picked Up",
                Returned: "Returned",
                Lost:     "Lost",
            };

            requests.forEach(r => {
                log.push({
                    action:         actionLabel[r.status] || r.status,
                    lib_id:         r.responded_by_id  || "—",
                    isbn:        r.isbn           || "—",
                    condition:      r.book_condition    || "—",
                    request_time:   r.request_time,
                    responded_time: r.responded_time    || null,
                    returned_time:  r.returned_time     || null,
                });
            });
        }

        res.json(log);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ═══════════════════════════════════════════════════════
//  BOOKS
// ═══════════════════════════════════════════════════════
const getAllBooks = async (req, res) => {
    try {
        const books = await Book.find().sort({ title: 1 });
        res.json(books);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const checkBookId = async (req, res) => {
    try {
        const exists = await Book.findOne({ isbn: req.params.isbn });
        res.json({ taken: !!exists });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ═══════════════════════════════════════════════════════
//  STUDENTS
// ═══════════════════════════════════════════════════════
const getAllStudents = async (req, res) => {
    try {
        const students = await Student.find().sort({ lName: 1 });
        res.json(students);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updateStudent = async (req, res) => {
    try {
        const { stu_id, fName, mName, lName, yearAndSection, pin } = req.body;
        const fields = {};
        if (stu_id)         fields.stu_id         = stu_id;
        if (fName)          fields.fName          = fName;
        if (mName)          fields.mName          = mName;
        if (lName)          fields.lName          = lName;
        if (yearAndSection) fields.yearAndSection = yearAndSection;
        if (pin) {
            if (!/^\d{1,6}$/.test(pin))
                return res.status(400).json({ message: "PIN must be up to 6 digits (numbers only)" });
            fields.pin = pin;
        }

        // If stu_id is being changed, check it's not already taken
        if (stu_id) {
            const conflict = await Student.findOne({ stu_id, _id: { $ne: req.params.id } });
            if (conflict) return res.status(409).json({ message: `Student ID "${stu_id}" is already taken` });
        }

        const labelMap = { stu_id:"ID", fName:"First", mName:"Middle", lName:"Last",
            yearAndSection:"Section", pin:"PIN" };
        const changed = Object.keys(req.body).find(k => labelMap[k]);
        fields.updated_by_id    = null;
        fields.updated_by_name  = "ADMIN";
        fields.updated_at       = new Date();
        fields.updated_field    = changed ? (labelMap[changed] || changed) : null;

        const updated = await Student.findByIdAndUpdate(req.params.id, fields, { returnDocument: 'after' });
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
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deleteStudent = async (req, res) => {
    try {
        const deleted = await Student.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: "Student not found" });
        res.json({ message: "Student deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const setStudentStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!["active", "hold"].includes(status))
            return res.status(400).json({ message: "Status must be active or hold" });
        const updated = await Student.findByIdAndUpdate(req.params.id, { status }, { returnDocument: 'after' });
        if (!updated) return res.status(404).json({ message: "Student not found" });
        res.json({ message: `Student set to ${status}`, student: updated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ═══════════════════════════════════════════════════════
//  LIBRARIANS
// ═══════════════════════════════════════════════════════
const getAllLibrarians = async (req, res) => {
    try {
        const librarians = await Librarian.find().sort({ lName: 1 });
        res.json(librarians);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updateLibrarian = async (req, res) => {
    try {
        const { lib_id, fName, mName, lName, cNumber, unp_email, pin } = req.body;
        const fields = {};
        if (lib_id)    fields.lib_id    = lib_id;
        if (fName)     fields.fName     = fName;
        if (mName)     fields.mName     = mName;
        if (lName)     fields.lName     = lName;
        if (cNumber)   fields.cNumber   = cNumber;
        if (unp_email) fields.unp_email = unp_email;
        if (pin) {
            if (!/^\d{1,6}$/.test(pin))
                return res.status(400).json({ message: "PIN must be up to 6 digits (numbers only)" });
            fields.pin = pin;
        }

        // If lib_id is being changed, check it's not already taken
        if (lib_id) {
            const conflict = await Librarian.findOne({ lib_id, _id: { $ne: req.params.id } });
            if (conflict) return res.status(409).json({ message: `Librarian ID "${lib_id}" is already taken` });
        }

        const updated = await Librarian.findByIdAndUpdate(req.params.id, fields, { returnDocument: 'after' });
        if (!updated) return res.status(404).json({ message: "Librarian not found" });
        res.json({ message: "Librarian updated", librarian: updated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deleteLibrarian = async (req, res) => {
    try {
        const deleted = await Librarian.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: "Librarian not found" });
        res.json({ message: "Librarian deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const setLibrarianStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!["active", "hold"].includes(status))
            return res.status(400).json({ message: "Status must be active or hold" });
        const updated = await Librarian.findByIdAndUpdate(req.params.id, { status }, { returnDocument: 'after' });
        if (!updated) return res.status(404).json({ message: "Librarian not found" });
        res.json({ message: `Librarian set to ${status}`, librarian: updated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


// ═══════════════════════════════════════════════════════
//  LOGO — upload (POST) and fetch (GET)
//  Image is saved to /uploadAdmin/ on disk.
//  getLogo returns the public URL path.
// ═══════════════════════════════════════════════════════
const fs        = require("fs");
const path      = require("path");
const UPLOAD_DIR = path.join(__dirname, "..", "uploadAdmin");
const LOGO_META  = path.join(UPLOAD_DIR, "student-logo.meta.json");

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const uploadLogo = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const ext      = path.extname(req.file.originalname).toLowerCase() || ".png";
        const filename = `student-logo${ext}`;
        const destPath = path.join(UPLOAD_DIR, filename);

        // Remove any old logo files (different extension)
        try {
            fs.readdirSync(UPLOAD_DIR)
                .filter(f => f.startsWith("student-logo.") && !f.endsWith(".meta.json"))
                .forEach(f => fs.unlinkSync(path.join(UPLOAD_DIR, f)));
        } catch (_) {}

        fs.renameSync(req.file.path, destPath);
        fs.writeFileSync(LOGO_META, JSON.stringify({ filename, updatedAt: new Date() }));

        res.json({ message: "Logo updated successfully", url: `/uploadAdmin/${filename}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getLogo = async (req, res) => {
    try {
        if (!fs.existsSync(LOGO_META)) return res.json({ url: null });
        const meta     = JSON.parse(fs.readFileSync(LOGO_META, "utf8"));
        const filePath = path.join(UPLOAD_DIR, meta.filename);
        if (!fs.existsSync(filePath)) return res.json({ url: null });
        res.json({ url: `/uploadAdmin/${meta.filename}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getAllTransactions, getActivityLog,
    getAllBooks, checkBookId,
    getAllStudents, updateStudent, deleteStudent, setStudentStatus,
    getAllLibrarians, updateLibrarian, deleteLibrarian, setLibrarianStatus,
    uploadLogo, getLogo,
};