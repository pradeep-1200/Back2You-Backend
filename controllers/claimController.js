const Claim = require("../models/Claim");
const Item = require("../models/Item");

// POST /claims — Submit a claim
const createClaim = async (req, res) => {
  try {
    const { itemId, userId, proofMessage } = req.body;

    if (!itemId || !userId || !proofMessage)
      return res.status(400).json({ error: "itemId, userId, and proofMessage are required" });

    // Check item exists
    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ error: "Item not found" });

    // Check duplicate claim
    const existing = await Claim.findOne({ itemId, userId });
    if (existing)
      return res.status(409).json({ error: "You have already claimed this item" });

    const claim = await Claim.create({ itemId, userId, proofMessage });
    res.status(201).json(claim);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PATCH /claims/:id — Approve, complete, or reject a claim
const updateClaimStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["requested", "approved", "completed", "rejected"].includes(status))
      return res.status(400).json({ error: "Invalid status" });

    const claim = await Claim.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate("itemId userId");

    if (!claim) return res.status(404).json({ error: "Claim not found" });

    // Gamification: Add 10 points if claim is completed
    if (status === "completed") {
      const User = require("../models/User");
      const Notification = require("../models/Notification");

      // Give 10 points to the person who reported the found item
      // Actually, itemId has a userId who is the creator of the item report
      const itemCreatorId = claim.itemId.userId; 
      
      if (itemCreatorId) {
        await User.findByIdAndUpdate(itemCreatorId, { $inc: { points: 10 } });
      }

      // Notify users
      await Notification.create({
        userId: claim.userId._id, // notify claimer
        message: "Your claim has been completed successfully. Don't forget to leave feedback!",
        type: "system"
      });
    }

    res.json(claim);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /claims/:id/message — Add a message to claim chat
const addClaimMessage = async (req, res) => {
  try {
    const { text, senderId } = req.body;
    if (!text || !senderId) return res.status(400).json({ error: "Text and senderId required" });

    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ error: "Claim not found" });

    claim.messages.push({
      sender: senderId,
      text
    });

    await claim.save();

    const populatedClaim = await Claim.findById(claim._id)
      .populate("messages.sender", "name avatar");

    res.json(populatedClaim);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /claims/:itemId — Get all claims for an item
const getClaimsByItem = async (req, res) => {
  try {
    const claims = await Claim.find({ itemId: req.params.itemId })
      .populate("userId", "name email")
      .sort({ createdAt: -1 });
    res.json(claims);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { createClaim, updateClaimStatus, getClaimsByItem, addClaimMessage };
