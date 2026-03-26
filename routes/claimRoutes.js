const express = require("express");
const router = express.Router();
const {
  createClaim,
  updateClaimStatus,
  getClaimsByItem,
} = require("../controllers/claimController");

router.post("/", createClaim);
router.patch("/:id", updateClaimStatus);
router.get("/item/:itemId", getClaimsByItem);

module.exports = router;
