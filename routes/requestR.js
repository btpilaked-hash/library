const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/auth");

const {
    createRequest,
    getRequests,
    approveRequest
} = require("../controllers/requestController");

//Student creates request
router.post("/", authenticate, requireRole("student"), createRequest);

//Admin/Librarian views requests
router.get("/", authenticate, requireRole("admin", "librarian"), getRequests);

//Approve request
router.put("/:id/approve", authenticate, requireRole("admin", "librarian"), approveRequest);

module.exports = router;