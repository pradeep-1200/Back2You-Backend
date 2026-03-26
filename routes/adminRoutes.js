const express = require("express");
const router = express.Router();
const { protect, admin } = require("../middleware/authMiddleware");

const {
  getAdminItems,
  deleteAdminItem,
  getAdminClaims,
  updateClaimStatus,
  getAdminUsers,
  banUser,
  getAdminStats,
} = require("../controllers/adminController");

router.get("/items", protect, admin, getAdminItems);
router.delete("/item/:id", protect, admin, deleteAdminItem);

router.get("/claims", protect, admin, getAdminClaims);
router.patch("/claim/:id", protect, admin, updateClaimStatus);

router.get("/users", protect, admin, getAdminUsers);
router.patch("/user/:id/ban", protect, admin, banUser);

router.get("/stats", protect, admin, getAdminStats);

module.exports = router;
