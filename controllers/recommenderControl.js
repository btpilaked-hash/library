const Student = require("../models/Student");
const Book = require("../models/shelf_a");
const Request = require("../models/request");

const recommendBooks = async (req, res) => {
    try {
        const stu_id = req.user.stu_id;
        const limit = parseInt(req.query.n) || 6;
        const search = req.query.q ? req.query.q.toLowerCase() : "";

        const stu = await Student.findOne({ stu_id });
        if (!stu) return res.json({ recommendations: [] });

        const books = await Book.find({});
        const favorites = stu.favorites || [];
        const searches = stu.search_log || [];

        const scored = books.map(book => {
            let score = 0;

            // ⭐ Favorite-based scoring
            if (favorites.some(f => f.genre === book.genre)) score += 3;
            if (favorites.some(f => f.isbn === book.isbn)) score += 5;

            // 🔍 Search-based scoring
            if (searches.some(s => book.title.toLowerCase().includes(s.term))) score += 2;
            if (searches.some(s => book.author.toLowerCase().includes(s.term))) score += 2;

            // 🔎 Query search
            if (search) {
                if (book.title.toLowerCase().includes(search)) score += 4;
                if (book.genre.toLowerCase().includes(search)) score += 3;
                if (book.author.toLowerCase().includes(search)) score += 2;
            }

            return { book, score };
        });

        const recommendations = scored
            .filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(x => x.book);

        res.json({ recommendations });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
const trendingBooks = async (req, res) => {
    try {
        const limit = parseInt(req.query.n) || 6;

        const books = await Book.find({});
        const requests = await Request.find({});

        const counts = {};
        requests.forEach(r => {
            counts[r.isbn] = (counts[r.isbn] || 0) + 1;
        });

        const scored = books.map(book => ({
            book,
            score: counts[book.isbn] || 0
        }));

        const trending = scored
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(x => x.book);

        res.json({ trending });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { recommendBooks, trendingBooks } ;