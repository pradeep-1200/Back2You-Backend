const express = require("express");
const router = express.Router();
const { 
  createUser, 
  getAllUsers, 
  getUserItems, 
  getUserClaims, 
  saveItem, 
  getSavedItems 
} = require("../controllers/userController");
const { protect, admin } = require("../middleware/authMiddleware");

router.post("/", createUser);
router.get("/", protect, admin, getAllUsers);

router.get("/saved", protect, getSavedItems);
router.post("/save/:itemId", protect, saveItem);
router.get("/:id/items", protect, getUserItems);
router.get("/:id/claims", protect, getUserClaims);

module.exports = router;
