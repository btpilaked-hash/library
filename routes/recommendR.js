const express = require("express");
const router = express.Router();

const { authenticate, requireRole } = require("../middleware/auth");
const { recommendBooks, trendingBooks } = require("../controllers/recommenderControl");

// Personalized recommendations
router.get("/", authenticate, requireRole("student"), recommendBooks);
router.get("/trending", trendingBooks);

module.exports = router;