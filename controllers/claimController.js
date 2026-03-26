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

// PATCH /claims/:id — Approve or reject a claim
const updateClaimStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["approved", "rejected"].includes(status))
      return res.status(400).json({ error: "Status must be 'approved' or 'rejected'" });

    const claim = await Claim.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate("itemId userId");

    if (!claim) return res.status(404).json({ error: "Claim not found" });
    res.json(claim);
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

module.exports = { createClaim, updateClaimStatus, getClaimsByItem };
