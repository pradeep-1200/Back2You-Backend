const Item = require("../models/Item");
const Claim = require("../models/Claim");
const User = require("../models/User");
const ActivityLog = require("../models/ActivityLog");
const { finalizeApprovedClaim } = require("../utils/claimResolution");
const { adjustTrustScore, getTrustLevel, logModerationAction, notifyAdmins } = require("../utils/moderation");
const { getStats } = require("./statController");

const formatUser = (user) => ({
  ...user.toObject(),
  trustLevel: getTrustLevel(user.trustScore),
});

const getAdminItems = async (req, res) => {
  try {
    const items = await Item.find({})
      .populate("userId", "name email trustScore role")
      .populate("matchedItem", "title status")
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    console.error("getAdminItems error:", error.message);
    res.status(500).json({ error: "Server Error" });
  }
};

const deleteAdminItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    await Promise.all([
      Claim.deleteMany({ itemId: item._id }),
      User.updateMany({ savedItems: item._id }, { $pull: { savedItems: item._id } }),
      Item.updateMany({ matchedItem: item._id }, { $set: { matchedItem: null } }),
    ]);

    await item.deleteOne();

    await logModerationAction({
      actorId: req.user._id,
      action: "item_deleted",
      targetType: "item",
      targetId: item._id,
      details: `Deleted item "${item.title}" globally.`,
    });

    res.json({ message: "Item removed globally" });
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

const resolveAdminItem = async (req, res) => {
  try {
    const { matchedItemId = null, resolutionMessage = "Item successfully returned" } = req.body;
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    item.status = "resolved";
    item.resolvedAt = new Date();
    item.resolutionMessage = resolutionMessage;
    item.matchedItem = matchedItemId || item.matchedItem || null;
    await item.save();

    if (matchedItemId) {
      const matchedItem = await Item.findById(matchedItemId);
      if (matchedItem) {
        matchedItem.status = "resolved";
        matchedItem.matchedItem = item._id;
        matchedItem.resolvedAt = item.resolvedAt;
        matchedItem.resolutionMessage = resolutionMessage;
        await matchedItem.save();
      }
    }

    await logModerationAction({
      actorId: req.user._id,
      action: "item_resolved_manually",
      targetType: "item",
      targetId: item._id,
      details: `Marked "${item.title}" as resolved manually.`,
    });

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAdminClaims = async (req, res) => {
  try {
    const claims = await Claim.find({})
      .populate("itemId", "title status location")
      .populate("userId", "name email trustScore")
      .sort({ createdAt: -1 });
    res.json(claims);
  } catch (error) {
    console.error("getAdminClaims error:", error.message);
    res.status(500).json({ error: "Server Error" });
  }
};

const updateClaimStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid admin claim status action" });
    }

    const claim = await Claim.findById(req.params.id).populate("itemId userId");
    if (!claim) {
      return res.status(404).json({ error: "Claim not found" });
    }

    claim.status = status;
    await claim.save();

    if (status === "approved") {
      await finalizeApprovedClaim({ claim, io: req.io, actorId: req.user._id });
    }

    if (status === "rejected") {
      await adjustTrustScore(claim.userId._id, -10);
      await notifyAdmins({
        message: `Admin rejected claim ${claim._id} for item ${claim.itemId?.title || "unknown item"}.`,
        io: req.io,
      });
      await logModerationAction({
        actorId: req.user._id,
        action: "claim_rejected",
        targetType: "claim",
        targetId: claim._id,
        details: `Rejected claim for ${claim.itemId?.title || "unknown item"}.`,
      });
    }

    res.json(claim);
  } catch (error) {
    console.error("updateClaimStatus error:", error.message);
    res.status(500).json({ error: error.message || "Server Error" });
  }
};

const getAdminUsers = async (req, res) => {
  try {
    const users = await User.find({}).select("-password").sort({ createdAt: -1 });
    res.json(users.map(formatUser));
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

const banUser = async (req, res) => {
  try {
    const { isBanned } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: "Admins cannot ban themselves" });
    }

    const wasBanned = user.isBanned;
    user.isBanned = Boolean(isBanned);
    await user.save();

    if (!wasBanned && user.isBanned) {
      await adjustTrustScore(user._id, -20);
      await notifyAdmins({
        message: `Moderation alert: ${user.email} was banned and trust score was reduced.`,
        io: req.io,
      });
    }

    await logModerationAction({
      actorId: req.user._id,
      action: user.isBanned ? "user_banned" : "user_unbanned",
      targetType: "user",
      targetId: user._id,
      details: `${user.email} is now ${user.isBanned ? "banned" : "active"}.`,
    });

    res.json({ message: `User ${user.isBanned ? "banned" : "unbanned"}`, user: formatUser(user) });
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.role = role;
    await user.save();

    await logModerationAction({
      actorId: req.user._id,
      action: "user_role_updated",
      targetType: "user",
      targetId: user._id,
      details: `${user.email} role changed to ${role}.`,
    });

    res.json({ message: `User promoted to ${role}`, user: formatUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAdminStats = async (req, res) => {
  return getStats(req, res);
};

const getAdminActivity = async (req, res) => {
  try {
    const activity = await ActivityLog.find({})
      .populate("actorId", "name email role")
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(activity);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
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
};
