const express = require("express");
const router = express.Router();
const { createFeedback, getFeedback } = require("../controllers/feedbackController");
const { protect } = require("../middleware/authMiddleware");

router.post("/", protect, createFeedback);
router.get("/", getFeedback);

module.exports = router;
