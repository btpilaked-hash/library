const express = require("express");
const router  = express.Router();
const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");

// ── Multer: save to /uploadAdmin/ with a temp name, controller finalises it ──
const uploadDir = path.join(__dirname, "..", "uploadAdmin");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename:    (req, file, cb) => cb(null, `tmp-logo-${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) cb(null, true);
        else cb(new Error("Only image files are allowed"));
    },
});

const {
    getAllTransactions,
    getAllBooks, checkBookId,
    getAllStudents, updateStudent, deleteStudent, setStudentStatus,
    getAllLibrarians, updateLibrarian, deleteLibrarian, setLibrarianStatus,
    getActivityLog,
    uploadLogo, getLogo,
} = require("../controllers/adminControl");

// ── Transactions ───────────────────────────────────────
router.get("/transactions",          getAllTransactions);

// ── Books ──────────────────────────────────────────────
router.get("/books",                 getAllBooks);
router.get("/books/check/:isbn",     checkBookId);
router.get("/book-log",              getActivityLog);

// ── Students ───────────────────────────────────────────
router.get("/students",              getAllStudents);
router.put("/students/:id",          updateStudent);
router.delete("/students/:id",       deleteStudent);
router.put("/students/:id/status",   setStudentStatus);

// ── Librarians ─────────────────────────────────────────
router.get("/librarians",            getAllLibrarians);
router.put("/librarians/:id",        updateLibrarian);
router.delete("/librarians/:id",     deleteLibrarian);
router.put("/librarians/:id/status", setLibrarianStatus);

// ── Activity Log ───────────────────────────────────────
router.get("/shift-log",             getActivityLog);
router.get("/activity-log",          getActivityLog);

// ── Logo ───────────────────────────────────────────────
// POST body: { dataUrl: "data:image/png;base64,..." }
router.post("/upload-logo",          upload.single("logo"), uploadLogo);
router.get("/logo",                  getLogo);

module.exports = router;