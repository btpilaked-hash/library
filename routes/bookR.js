const express    = require("express");
const path       = require("path");
const Shelf      = require("../models/shelf_a");
const Student    = require("../models/Student");
const Librarian  = require("../models/Librarian");
const { authenticate, requireRole } = require("../middleware/auth");
const { cloudinary, upload } = require("../config/cloudinary");

const router = express.Router();

// ── POST /api/book/addBook ─────────────────────────────
router.post("/addBook", upload.single("image"), async (req, res) => {
    try {
        const {
            title, author, isbn,
            total_copies, available_copies,
            category, genre, publisher, publish_year,
        } = req.body;

        if (!title || !author || !isbn || !total_copies ||
            !available_copies || !category || !genre || !publisher || !publish_year) {
            return res.status(400).json({ message: "Please fill in all fields." });
        }
        if (!req.file) return res.status(400).json({ message: "Please upload an image." });

        const exists = await Shelf.findOne({ isbn });
        if (exists) return res.status(409).json({ message: "ISBN already exists." });

        let lib_id_str = null, lib_name = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            try {
                const jwt     = require("jsonwebtoken");
                const SECRET  = process.env.JWT_SECRET || "library_sec";
                const payload = jwt.verify(authHeader.slice(7), SECRET);
                if (payload.role === "librarian") {
                    const lib = await Librarian.findById(payload.id);
                    if (lib) {
                        lib_id_str = lib.lib_id;
                        lib_name   = `${lib.lName}, ${lib.fName} ${lib.mName}`;
                    }
                }
            } catch (_) {}
        }

        const newBook = new Shelf({
            title, author, isbn,
            total_copies:     Number(total_copies),
            available_copies: Number(available_copies),
            category, genre, publisher,
            publish_year:  new Date(publish_year),
            image:         req.file.path,
            added_by_id:   lib_id_str,
            added_by_name: lib_name,
        });

        await newBook.save();
        res.status(201).json({ message: "Book added successfully!" });
    } catch (err) {
        res.status(500).json({ message: "Server error: " + err.message });
    }
});

// ── GET /api/book/getBooks ─────────────────────────────
router.get("/getBooks", async (req, res) => {
    try {
        const books = await Shelf.find();
        res.json(books);
    } catch (err) {
        res.status(500).json({ message: "Server error: " + err.message });
    }
});

// ── GET /api/book/getBook/:id ──────────────────────────
router.get("/getBook/:id", async (req, res) => {
    try {
        const book = await Shelf.findById(req.params.id);
        if (!book) return res.status(404).json({ message: "Book not found." });
        res.json(book);
    } catch (err) {
        res.status(500).json({ message: "Server error: " + err.message });
    }
});

// ── PUT /api/book/updateBook/admin/:id ────────────────
router.put("/updateBook/admin/:id", async (req, res) => {
    try {
        const fields = { ...req.body, edited_at: new Date() };
        const book   = await Shelf.findByIdAndUpdate(req.params.id, fields, { returnDocument: 'after' });
        if (!book) return res.status(404).json({ message: "Book not found." });
        res.json({ message: "Book updated successfully!", book });
    } catch (err) {
        res.status(500).json({ message: "Server error: " + err.message });
    }
});

// ── PUT /api/book/updateBook/:id (librarian token) ───
router.put("/updateBook/:id", authenticate, requireRole("librarian"), async (req, res) => {
    try {
        const fields = { ...req.body };
        const lib    = await Librarian.findById(req.user.id);
        fields.edited_by_id   = lib ? lib.lib_id : null;
        fields.edited_by_name = lib ? `${lib.lName}, ${lib.fName} ${lib.mName}` : "Unknown";
        fields.edited_at      = new Date();
        const book = await Shelf.findByIdAndUpdate(req.params.id, fields, { returnDocument: 'after' });
        if (!book) return res.status(404).json({ message: "Book not found." });
        res.json({ message: "Book updated successfully!", book });
    } catch (err) {
        res.status(500).json({ message: "Server error: " + err.message });
    }
});

// ── DELETE /api/book/deleteBook/:id ───────────────────
router.delete("/deleteBook/:id", async (req, res) => {
    try {
        const book = await Shelf.findByIdAndDelete(req.params.id);
        if (!book) return res.status(404).json({ message: "Book not found." });

        // Delete from Cloudinary
        if (book.image) {
            try {
                const parts    = book.image.split("/");
                const filename = parts[parts.length - 1].split(".")[0];
                const publicId = `ccit_library/${filename}`;
                await cloudinary.uploader.destroy(publicId);
            } catch (e) {
                console.warn("Could not delete from Cloudinary:", e.message);
            }
        }

        // Remove from every student's favorites array
        await Student.updateMany(
            { "favorites.isbn": book.isbn },
            { $pull: { favorites: { isbn: book.isbn } } }
        );

        res.json({ message: "Book deleted and removed from all favorites." });
    } catch (err) {
        res.status(500).json({ message: "Server error: " + err.message });
    }
});

// ── GET /api/book/getByISBN/:isbn ─────────────────────
router.get("/getByISBN/:isbn", async (req, res) => {
    try {
        const book = await Shelf.findOne({ isbn: req.params.isbn });
        if (!book) return res.status(404).json({ message: "Not found." });
        res.json(book);
    } catch (err) {
        res.status(500).json({ message: "Server error: " + err.message });
    }
});

module.exports = router;