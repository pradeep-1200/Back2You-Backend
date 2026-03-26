const User = require("../models/User");
const { getTrustLevel } = require("../utils/moderation");

const ensureSelfOrAdmin = (req, res) => {
  if (req.user.role === "admin" || req.user._id.toString() === req.params.id) {
    return true;
  }

  res.status(403).json({ error: "Not authorized to access this user resource" });
  return false;
};

// POST /users — Create a new user
const createUser = async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email)
      return res.status(400).json({ error: "Name and email are required" });

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) return res.status(200).json(user); // return existing user

    user = await User.create({ name, email });
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /users — Get all users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const Item = require("../models/Item");
const Claim = require("../models/Claim");

// GET /users/:id/items — Get all items created by user
const getUserItems = async (req, res) => {
  try {
    if (!ensureSelfOrAdmin(req, res)) return;
    const items = await Item.find({ userId: req.params.id })
      .populate("matchedItem", "title status imageUrl resolvedAt resolutionMessage location")
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /users/:id/claims — Get all claims by user
const getUserClaims = async (req, res) => {
  try {
    if (!ensureSelfOrAdmin(req, res)) return;
    const claims = await Claim.find({ userId: req.params.id })
      .populate("itemId", "title status imageUrl")
      .sort({ createdAt: -1 });
    res.json(claims);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /users/save/:itemId — Save/Bookmark an item
const saveItem = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const itemId = req.params.itemId;
    const isSaved = user.savedItems.includes(itemId);

    if (isSaved) {
      user.savedItems = user.savedItems.filter((id) => id.toString() !== itemId);
    } else {
      user.savedItems.push(itemId);
    }

    await user.save();
    res.json({ savedItems: user.savedItems });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /users/saved — Get saved items
const getSavedItems = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: "savedItems",
      populate: { path: "matchedItem", select: "title status imageUrl resolvedAt resolutionMessage location" },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user.savedItems);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { createUser, getAllUsers, getUserItems, getUserClaims, saveItem, getSavedItems };
