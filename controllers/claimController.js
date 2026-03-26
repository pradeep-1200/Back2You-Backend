const Claim = require("../models/Claim");
const Item = require("../models/Item");
const Notification = require("../models/Notification");
const { finalizeApprovedClaim } = require("../utils/claimResolution");
const { adjustTrustScore, notifyAdmins } = require("../utils/moderation");

// POST /claims - Submit a claim
const createClaim = async (req, res) => {
  try {
    const { itemId, userId, proofMessage } = req.body;
    const claimantId = req.user?._id?.toString() || userId;

    if (!itemId || !claimantId || !proofMessage) {
      return res.status(400).json({ error: "itemId, userId, and proofMessage are required" });
    }

    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ error: "Item not found" });

    if (item.status !== "found") {
      return res.status(400).json({ error: "Only 'found' items can be claimed" });
    }

    const existing = await Claim.findOne({ itemId, userId: claimantId });
    if (existing) {
      return res.status(409).json({ error: "You have already claimed this item" });
    }

    const claim = await Claim.create({ itemId, userId: claimantId, proofMessage });

    const notification = await Notification.create({
      userId: item.userId,
      message: `Someone submitted a claim for your item: ${item.title}`,
      type: "claim",
    });

    if (req.io) {
      req.io.to(item.userId.toString()).emit("new notification", notification);
    }

    res.status(201).json(claim);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PATCH /claims/:id - Approve, complete, or reject a claim
const updateClaimStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "approved", "completed", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const claim = await Claim.findById(req.params.id).populate("itemId userId");
    if (!claim) return res.status(404).json({ error: "Claim not found" });

    const isOwner = claim.itemId?.userId?.toString?.() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Not authorized to update this claim" });
    }

    claim.status = status;
    await claim.save();

    if (status === "approved") {
      await finalizeApprovedClaim({ claim, io: req.io, actorId: req.user?._id });
    }

    if (status === "rejected") {
      const claimantIdValue = claim.userId?._id || claim.userId;
      await adjustTrustScore(claimantIdValue, -10);

      const rejectedClaims = await Claim.countDocuments({
        userId: claimantIdValue,
        status: "rejected",
      });

      if (rejectedClaims >= 3) {
        await notifyAdmins({
          message: `Suspicious activity: user ${claim.userId?.name || claimantIdValue} has ${rejectedClaims} rejected claims.`,
          io: req.io,
        });
      }
    }

    if (status === "completed") {
      const User = require("../models/User");

      const itemCreatorId = claim.itemId?.userId;
      if (itemCreatorId) {
        await User.findByIdAndUpdate(itemCreatorId, { $inc: { points: 10 } });
      }

      const notification = await Notification.create({
        userId: claim.userId._id,
        message: "Your claim has been completed successfully. Don't forget to leave feedback!",
        type: "system",
      });

      if (req.io) {
        req.io.to(claim.userId._id.toString()).emit("new notification", notification);
      }
    }

    const updatedClaim = await Claim.findById(claim._id).populate("itemId userId");
    res.json(updatedClaim);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /claims/:id/message - Add a message to claim chat
const addClaimMessage = async (req, res) => {
  try {
    const { text, senderId } = req.body;
    if (!text || !senderId) return res.status(400).json({ error: "Text and senderId required" });

    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ error: "Claim not found" });
    const claimItem = await Item.findById(claim.itemId).select("userId");
    const isParticipant = claim.userId.toString() === req.user._id.toString()
      || claimItem?.userId?.toString() === req.user._id.toString()
      || req.user.role === "admin";
    if (!isParticipant) {
      return res.status(403).json({ error: "Not authorized to message on this claim" });
    }

    claim.messages.push({
      sender: req.user._id,
      text,
    });

    await claim.save();

    const populatedClaim = await Claim.findById(claim._id).populate("messages.sender", "name avatar");

    if (req.io) {
      const claimObj = await Claim.findById(claim._id).populate("itemId");
      const otherUserId = claim.userId.toString() === req.user._id.toString()
        ? claimObj.itemId.userId.toString()
        : claim.userId.toString();

      req.io.to(otherUserId).emit("claim message", populatedClaim);
    }

    res.json(populatedClaim);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /claims/:itemId - Get all claims for an item
const getClaimsByItem = async (req, res) => {
  try {
    const claims = await Claim.find({ itemId: req.params.itemId })
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    const item = await Item.findById(req.params.itemId).select("userId");
    const canView = item && (item.userId.toString() === req.user._id.toString() || req.user.role === "admin");
    const ownClaims = claims.filter((claim) => claim.userId?._id?.toString() === req.user._id.toString());
    res.json(canView ? claims : ownClaims);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { createClaim, updateClaimStatus, getClaimsByItem, addClaimMessage };
