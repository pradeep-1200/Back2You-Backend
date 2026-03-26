const express = require("express");
const router = express.Router();
const {
  createClaim,
  updateClaimStatus,
  getClaimsByItem,
  addClaimMessage,
} = require("../controllers/claimController");
const { protect } = require("../middleware/authMiddleware");

router.post("/", protect, createClaim);
router.patch("/:id", protect, updateClaimStatus);
router.get("/item/:itemId", protect, getClaimsByItem);
router.post("/:id/message", protect, addClaimMessage);

module.exports = router;
