const express = require("express");
const router  = express.Router();

const { authenticate, requireRole } = require("../middleware/auth");
const { logS, regS }                = require("../controllers/lr_con");
const {
    ownAccStu,
    getBooks,
    requestBook,
    cancelRequest,
    showReq,
    showHistory,
    getFavorites,
    toggleFavorite,
} = require("../controllers/studentControl");

// ── Auth ───────────────────────────────────────────────
router.post("/login",    logS);
router.post("/register", regS);

// ── Profile ────────────────────────────────────────────
router.get("/profile", authenticate, requireRole("student"), ownAccStu);

// ── Books ──────────────────────────────────────────────
router.get("/books",   authenticate, requireRole("student"), getBooks);

// ── Requests ───────────────────────────────────────────
router.post("/requests",      authenticate, requireRole("student"), requestBook);
router.get("/requests",       authenticate, requireRole("student"), showReq);
router.delete("/requests/:id",authenticate, requireRole("student"), cancelRequest);

// ── Request History (Returned + Lost) ─────────────────
router.get("/history",        authenticate, requireRole("student"), showHistory);

// ── Favorites ──────────────────────────────────────────
router.get("/favorites",  authenticate, requireRole("student"), getFavorites);
router.post("/favorites", authenticate, requireRole("student"), toggleFavorite);

module.exports = router;