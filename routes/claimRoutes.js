const express = require("express");
const router = express.Router();
const {
  createClaim,
  updateClaimStatus,
  getClaimsByItem,
  addClaimMessage,
} = require("../controllers/claimController");

router.post("/", createClaim);
router.patch("/:id", updateClaimStatus);
router.get("/item/:itemId", getClaimsByItem);
router.post("/:id/message", addClaimMessage);

module.exports = router;
