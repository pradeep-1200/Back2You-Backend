const Feedback = require("../models/Feedback");
const User = require("../models/User");

// POST /feedback
const createFeedback = async (req, res) => {
  try {
    const { rating, comment, claimId } = req.body;
    if (!rating) return res.status(400).json({ error: "Rating is required" });

    const feedback = await Feedback.create({
      userId: req.user._id,
      rating,
      comment
    });

    // Optional: add more points to user for leaving feedback!
    await User.findByIdAndUpdate(req.user._id, { $inc: { points: 2 } });

    res.status(201).json(feedback);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /feedback
const getFeedback = async (req, res) => {
  try {
    const feedbacks = await Feedback.find().populate("userId", "name avatar").sort({ createdAt: -1 });
    res.json(feedbacks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { createFeedback, getFeedback };
