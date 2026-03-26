const Item = require("../models/Item");
const Claim = require("../models/Claim");
const User = require("../models/User");

// @desc    Get all items
// @route   GET /api/admin/items
// @access  Private/Admin
const getAdminItems = async (req, res) => {
  try {
    const items = await Item.find({}).populate("user", "name email").sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Delete item
// @route   DELETE /api/admin/item/:id
// @access  Private/Admin
const deleteAdminItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }
    await item.deleteOne();
    res.json({ message: "Item removed" });
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Get all claims
// @route   GET /api/admin/claims
// @access  Private/Admin
const getAdminClaims = async (req, res) => {
  try {
    const claims = await Claim.find({})
      .populate("item")
      .populate("claimant", "name email")
      .sort({ createdAt: -1 });
    res.json(claims);
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Update claim status
// @route   PATCH /api/admin/claim/:id
// @access  Private/Admin
const updateClaimStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const claim = await Claim.findById(req.params.id).populate("item");
    if (!claim) {
      return res.status(404).json({ error: "Claim not found" });
    }
    claim.status = status;
    await claim.save();

    // If claim approved, mark item as claimed/completed
    if (status === "approved" && claim.item) {
      const item = await Item.findById(claim.item._id);
      if (item) {
        item.status = "claimed";
        await item.save();
      }
    }

    res.json(claim);
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
const getAdminUsers = async (req, res) => {
  try {
    const users = await User.find({}).select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Ban or unban user
// @route   PATCH /api/admin/user/:id/ban
// @access  Private/Admin
const banUser = async (req, res) => {
  try {
    const { isBanned } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    user.isBanned = isBanned;
    await user.save();
    res.json({ message: `User ${isBanned ? 'banned' : 'unbanned'}`, user });
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

// @desc    Get admin stats
// @route   GET /api/admin/stats
// @access  Private/Admin
const getAdminStats = async (req, res) => {
  try {
    const totalItems = await Item.countDocuments();
    const totalClaims = await Claim.countDocuments();
    const activeUsers = await User.countDocuments({ isBanned: false });
    res.json({ totalItems, totalClaims, activeUsers });
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

module.exports = {
  getAdminItems,
  deleteAdminItem,
  getAdminClaims,
  updateClaimStatus,
  getAdminUsers,
  banUser,
  getAdminStats,
};
