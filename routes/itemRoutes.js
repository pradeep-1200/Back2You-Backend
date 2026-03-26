const express = require("express");
const router = express.Router();
const {
  createItem,
  updateItem,
  deleteItem,
  getAllItems,
  searchItems,
  getItemById,
  getTrendingTags,
  getSuggestions,
  getRecentActivity,
} = require("../controllers/itemController");
const { upload } = require("../utils/cloudinary");
const { protect } = require("../middleware/authMiddleware");

router.post("/", protect, upload.single("image"), createItem);
router.patch("/:id", protect, upload.single("image"), updateItem);
router.delete("/:id", protect, deleteItem);
router.get("/", getAllItems);
router.get("/trending-tags", getTrendingTags);
router.get("/suggestions", getSuggestions);
router.get("/recent-activity", getRecentActivity);
router.get("/search", searchItems);
router.get("/:id", getItemById);

module.exports = router;
