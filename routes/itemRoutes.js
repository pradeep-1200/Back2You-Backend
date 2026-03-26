const express = require("express");
const router = express.Router();
const {
  createItem,
  getAllItems,
  searchItems,
  getItemById,
  getTrendingTags,
  getSuggestions,
  getRecentActivity,
} = require("../controllers/itemController");
const { upload } = require("../utils/cloudinary");

router.post("/", upload.single("image"), createItem);
router.get("/", getAllItems);
router.get("/trending-tags", getTrendingTags);
router.get("/suggestions", getSuggestions);
router.get("/recent-activity", getRecentActivity);
router.get("/search", searchItems);
router.get("/:id", getItemById);

module.exports = router;
