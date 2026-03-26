const express = require("express");
const router = express.Router();
const { protect, admin } = require("../middleware/authMiddleware");

const {
  getAdminItems,
  deleteAdminItem,
  resolveAdminItem,
  getAdminClaims,
  updateClaimStatus,
  getAdminUsers,
  banUser,
  updateUserRole,
  getAdminStats,
  getAdminActivity,
} = require("../controllers/adminController");

router.get("/items", protect, admin, getAdminItems);
router.delete("/items/:id", protect, admin, deleteAdminItem);
router.patch("/items/:id/resolve", protect, admin, resolveAdminItem);

router.get("/claims", protect, admin, getAdminClaims);
router.patch("/claims/:id", protect, admin, updateClaimStatus);

router.get("/users", protect, admin, getAdminUsers);
router.patch("/users/:id/ban", protect, admin, banUser);
router.patch("/users/:id/role", protect, admin, updateUserRole);

router.get("/stats", protect, admin, getAdminStats);
router.get("/activity", protect, admin, getAdminActivity);

module.exports = router;
