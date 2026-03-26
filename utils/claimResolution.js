const Claim = require("../models/Claim");
const Item = require("../models/Item");
const Notification = require("../models/Notification");
const { adjustTrustScore, logModerationAction } = require("./moderation");

const RESOLUTION_MESSAGE = "Item successfully returned";

const normalizeTokens = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);

const scoreLostCandidate = (foundItem, lostItem) => {
  let score = 0;

  const foundTitleTokens = normalizeTokens(foundItem.title);
  const lostTitleTokens = normalizeTokens(lostItem.title);
  const foundDescTokens = normalizeTokens(foundItem.description);
  const lostDescTokens = normalizeTokens(lostItem.description);

  const sharedTitle = foundTitleTokens.filter((token) => lostTitleTokens.includes(token)).length;
  const sharedDesc = foundDescTokens.filter((token) => lostDescTokens.includes(token)).length;
  const sharedTags = (foundItem.tags || []).filter((tag) =>
    (lostItem.tags || []).some((candidateTag) => candidateTag.toLowerCase() === tag.toLowerCase())
  ).length;

  score += sharedTitle * 4;
  score += sharedDesc * 2;
  score += sharedTags * 5;

  if (
    foundItem.location &&
    lostItem.location &&
    foundItem.location.toLowerCase().includes(lostItem.location.toLowerCase())
  ) {
    score += 6;
  }

  return score;
};

const resolveLostItemForClaim = async (claim) => {
  const foundItemId = claim.itemId?._id || claim.itemId;
  const claimantId = claim.userId?._id || claim.userId;

  const foundItem = await Item.findById(foundItemId);
  if (!foundItem) {
    throw new Error("Found item not found");
  }

  const matchedIds = foundItem.matches
    ?.map((match) => match.item)
    .filter(Boolean) || [];

  const lostItem = await Item.findOne({
    userId: claimantId,
    status: "lost",
    $or: [
      { _id: { $in: matchedIds } },
      { "matches.item": foundItem._id },
      { matchedItem: foundItem._id },
    ],
  }).sort({ updatedAt: -1, createdAt: -1 });

  if (lostItem) {
    return { foundItem, lostItem };
  }

  const claimantLostItems = await Item.find({
    userId: claimantId,
    status: "lost",
    matchedItem: null,
  }).sort({ updatedAt: -1, createdAt: -1 });

  if (claimantLostItems.length === 1) {
    return { foundItem, lostItem: claimantLostItems[0] };
  }

  const rankedCandidate = claimantLostItems
    .map((candidate) => ({
      candidate,
      score: scoreLostCandidate(foundItem, candidate),
    }))
    .sort((a, b) => b.score - a.score)[0];

  if (rankedCandidate?.candidate && rankedCandidate.score > 0) {
    return { foundItem, lostItem: rankedCandidate.candidate };
  }

  throw new Error("No matching lost report found for this claimant. Ask the claimant to submit a lost report first.");
};

const finalizeApprovedClaim = async ({ claim, io, actorId = null }) => {
  const { foundItem, lostItem } = await resolveLostItemForClaim(claim);
  const resolvedAt = new Date();

  foundItem.status = "resolved";
  foundItem.matchedItem = lostItem._id;
  foundItem.resolvedAt = resolvedAt;
  foundItem.resolutionMessage = RESOLUTION_MESSAGE;

  lostItem.status = "resolved";
  lostItem.matchedItem = foundItem._id;
  lostItem.resolvedAt = resolvedAt;
  lostItem.resolutionMessage = RESOLUTION_MESSAGE;

  await Promise.all([foundItem.save(), lostItem.save()]);
  await Promise.all([
    adjustTrustScore(foundItem.userId, 10),
    adjustTrustScore(claim.userId?._id || claim.userId, 10),
  ]);

  await Claim.updateMany(
    {
      itemId: foundItem._id,
      _id: { $ne: claim._id },
      status: { $in: ["pending", "approved"] },
    },
    { $set: { status: "rejected" } }
  );

  const participants = [
    foundItem.userId?.toString(),
    claim.userId?._id?.toString() || claim.userId?.toString(),
  ].filter(Boolean);

  const notifications = await Notification.insertMany(
    participants.map((userId) => ({
      userId,
      message: `${RESOLUTION_MESSAGE}. Both reports are now linked as recovered.`,
      type: "system",
    }))
  );

  if (io) {
    notifications.forEach((notification) => {
      io.to(notification.userId.toString()).emit("new notification", notification);
    });
  }

  await logModerationAction({
    actorId,
    action: "claim_approved_resolution",
    targetType: "claim",
    targetId: claim._id,
    details: `Resolved found item ${foundItem._id} with lost item ${lostItem._id}.`,
  });

  return { foundItem, lostItem, resolvedAt };
};

module.exports = {
  RESOLUTION_MESSAGE,
  finalizeApprovedClaim,
};
