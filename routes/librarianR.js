const express = require("express");
const multer  = require("multer");
const path    = require("path");
const router  = express.Router();

const { authenticate, requireRole } = require("../middleware/auth");
const { logL, regL }                = require("../controllers/lr_con");
const {
    ownAccLib,
    getReqBooks,
    accept_or_decline_book,
    markPickedUp,
    markReturned,
    markLost,
    getAllStudents,
    updateStudent,
    updateBook,
    shiftIn,
    shiftOut,
    myShifts,
} = require("../controllers/librarianControl");

// ── Multer — librarian profile pictures → uploadLib/ ──────────────────────
const { upload: uploadPic } = require("../config/cloudinary");

// ── Auth ───────────────────────────────────────────────────────────────────
router.post("/login", logL);

// Register — accepts multipart/form-data so picture can be uploaded alongside fields
router.post("/register", uploadPic.single("picture"), regL);

// ── Profile ────────────────────────────────────────────────────────────────
router.get("/profile", authenticate, requireRole("librarian"), ownAccLib);

// ── Requests ───────────────────────────────────────────────────────────────
router.get("/requests",              authenticate, requireRole("librarian"), getReqBooks);
router.put("/requests/:id",          authenticate, requireRole("librarian"), accept_or_decline_book);
router.put("/requests/:id/pickedup", authenticate, requireRole("librarian"), markPickedUp);
router.put("/requests/:id/returned", authenticate, requireRole("librarian"), markReturned);
router.put("/requests/:id/lost",     authenticate, requireRole("librarian"), markLost);

// ── Students ──────────────────────────────────────────────────────────────
router.get("/students",      authenticate, requireRole("librarian"), getAllStudents);
router.put("/students/:id",  authenticate, requireRole("librarian"), updateStudent);

// ── Books ──────────────────────────────────────────────────────────────────
router.put("/books/:id", authenticate, requireRole("librarian"), updateBook);

// ── Shift Log ──────────────────────────────────────────────────────────────
router.post("/shift/in",  authenticate, requireRole("librarian"), shiftIn);
router.post("/shift/out", authenticate, requireRole("librarian"), shiftOut);
router.get("/shift/mine", authenticate, requireRole("librarian"), myShifts);

module.exports = router;