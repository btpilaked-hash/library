const Student = require("../models/Student");
const Book    = require("../models/shelf_a");
const Request = require("../models/request");

// ── Profile ────────────────────────────────────────────────────────────────
const ownAccStu = async (req, res) => {
    try {
        const stu = await Student.findOne({ stu_id: req.user.stu_id }).select("-pin");
        if (!stu) return res.status(404).json({ message: "Student not found" });
        res.json(stu);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ── Available Books (with optional search + filters) ───────────────────────
const getBooks = async (req, res) => {
    try {
        const { search, category, genre } = req.query;
        const query = {};

        if (category) query.category = category;
        if (genre)    query.genre    = genre;
        if (search) {
            query.$or = [
                { title:     { $regex: search, $options: "i" } },
                { author:    { $regex: search, $options: "i" } },
                { genre:     { $regex: search, $options: "i" } },
                { publisher: { $regex: search, $options: "i" } },
                { category:  { $regex: search, $options: "i" } },
                { isbn:      { $regex: search, $options: "i" } },
            ];

            try {
                const stu = await Student.findOne({ stu_id: req.user.stu_id });

                console.log("STU:", req.user.stu_id);
                console.log("FAVORITES:", (stu?.favorites || []).length);
                console.log("SEARCH:", (stu?.search_log || []).length);
                const requests_ = await Request.find({});
                console.log("REQUESTS:", requests_.filter(r => r.stu_id === req.user.stu_id).length);

                if (stu) {
                    const term = search.trim().toLowerCase();
                    const last = stu.search_log[stu.search_log.length - 1];
                    if (!last || last.term !== term) {
                        stu.search_log.push({ term, searched_at: new Date() });
                        if (stu.search_log.length > 50) stu.search_log = stu.search_log.slice(-50);
                        await stu.save();
                    }
                }
            } catch (_) {}
        }

        const books = await Book.find(query);
        res.json(books);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const requestBook = async (req, res) => {
    try {
        const { mongo_id } = req.body;

        const stu = await Student.findById(req.user.id);
        if (!stu) return res.status(404).json({ message: "Student not found" });
        if (stu.status === "hold") {
            return res.status(403).json({
                message: "Your account is on hold. You cannot request books. Please contact the admin or librarian."
            });
        }
        const book = await Book.findById(mongo_id);
        if (!book)                     return res.status(404).json({ message: "Book not found" });
        if (book.available_copies < 1) return res.status(400).json({ message: "Book is not available" });

        const activeReq = await Request.findOne({
            stu_id: req.user.stu_id,
            isbn:   book.isbn,
            status: { $in: ["Pending", "Accepted", "PickedUp"] }
        });
        if (activeReq) return res.status(400).json({ message: "Already requested or borrowed" });

        // Decrement available_copies immediately so no other student can grab the last copy
        await Book.findByIdAndUpdate(mongo_id, { $inc: { available_copies: -1 } });

        const newReq = await Request.create({
            stu_id:         stu.stu_id,
            student_name:   `${stu.lName}, ${stu.fName} ${stu.mName}`,
            yearAndSection: stu.yearAndSection,
            isbn:           book.isbn,
            book_title:     book.title,
        });

        res.status(201).json({ message: "Book requested successfully", requested: newReq });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ── Cancel a Pending Request ───────────────────────────────────────────────
// Does NOT restore available_copies — copies are only decremented on Accept,
// so cancelling a Pending request requires no copy adjustment.
const cancelRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const request = await Request.findById(id);
        if (!request)                            return res.status(404).json({ message: "Request not found" });
        if (request.stu_id !== req.user.stu_id) return res.status(403).json({ message: "Not your request" });
        if (request.status !== "Pending")        return res.status(400).json({ message: "Only pending requests can be cancelled" });

        // Restore the copy we decremented when the student requested
        await Book.findOneAndUpdate(
            { isbn: request.isbn },
            { $inc: { available_copies: 1 } }
        );

        await Request.findByIdAndUpdate(id, { status: "Cancelled" });
        res.json({ message: "Request cancelled" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ── Show My Active Requests (non-history) ─────────────────────────────────
const showReq = async (req, res) => {
    try {
        const requests = await Request.find({
            stu_id: req.user.stu_id,
            status: { $in: ["Pending", "Accepted", "PickedUp", "Declined", "Cancelled"] }
        }).sort({ request_time: -1 });
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ── Show Request History (Returned + Lost only) ────────────────────────────
const showHistory = async (req, res) => {
    try {
        const history = await Request.find({
            stu_id: req.user.stu_id,
            status: { $in: ["Returned", "Lost"] }
        }).sort({ responded_time: -1 });
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ── Favorites ──────────────────────────────────────────────────────────────
const getFavorites = async (req, res) => {
    try {
        const stu = await Student.findOne({ stu_id: req.user.stu_id }).select("favorites");
        if (!stu) return res.status(404).json({ message: "Student not found" });
        res.json(stu.favorites || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Frontend sends: { book_id: mongoId }  (the MongoDB _id of the book)
const toggleFavorite = async (req, res) => {
    try {
        const { mongo_id } = req.body;  // fixed: was isbn, now book_id

        const book = await Book.findById(mongo_id);  // find by MongoDB _id
        if (!book) return res.status(404).json({ message: "Book not found" });

        const stu = await Student.findOne({ stu_id: req.user.stu_id });
        if (!stu) return res.status(404).json({ message: "Student not found" });

        const favorites = stu.favorites || [];
        const idx       = favorites.findIndex(f => f.isbn === book.isbn);
        let action;
        if (idx !== -1) {
            favorites.splice(idx, 1);
            action = "removed";
        } else {
            favorites.push({
                isbn:     book.isbn,
                mongo_id: book._id.toString(),
                title:    book.title,
                author:   book.author,
                genre:    book.genre,
            });
            action = "added";
        }
        stu.favorites = favorites;
        await stu.save();
        res.json({ message: `Favorite ${action}`, favorites });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    ownAccStu, requestBook, cancelRequest,
    showReq, showHistory, getBooks, getFavorites, toggleFavorite,
};

async function respond(requestId, status) {
    const message = document.getElementById("req_message");
    const label   = status === "Accepted" ? "accept" : "decline";
    if (!confirm(`Are you sure you want to ${label} this request?`)) return;
    try {
        const res  = await fetch(`${LIB_BASE}/requests/${requestId}`, {
            method: "PUT", headers: jsonHeaders(), body: JSON.stringify({ status })
        });
        const data = await res.json();
        message.innerText = data.message || (res.ok ? "Done." : "Failed.");
        if (res.ok) loadRequests();
    } catch (err) { message.innerText = "Cannot connect to server."; }
}