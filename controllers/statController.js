const Item = require("../models/Item");
const User = require("../models/User");
const Claim = require("../models/Claim");
const ActivityLog = require("../models/ActivityLog");

const getDateRange = (start, end) => ({
  createdAt: {
    $gte: start,
    $lt: end,
  },
});

const getStats = async (req, res) => {
  try {
    const now = new Date();
    const currentPeriodStart = new Date(now);
    currentPeriodStart.setDate(now.getDate() - 7);

    const previousPeriodStart = new Date(currentPeriodStart);
    previousPeriodStart.setDate(currentPeriodStart.getDate() - 7);

    const [
      totalItems,
      lostItems,
      foundItems,
      activeUsers,
      totalClaims,
      previousItems,
      previousLostItems,
      previousFoundItems,
      previousUsers,
      previousClaims,
      items,
      recentModerationActions,
    ] = await Promise.all([
      Item.countDocuments(),
      Item.countDocuments({ status: "lost" }),
      Item.countDocuments({ status: "found" }),
      User.countDocuments({ isBanned: false }),
      Claim.countDocuments(),
      Item.countDocuments(getDateRange(previousPeriodStart, currentPeriodStart)),
      Item.countDocuments({ ...getDateRange(previousPeriodStart, currentPeriodStart), status: "lost" }),
      Item.countDocuments({ ...getDateRange(previousPeriodStart, currentPeriodStart), status: "found" }),
      User.countDocuments({ ...getDateRange(previousPeriodStart, currentPeriodStart), isBanned: false }),
      Claim.countDocuments(getDateRange(previousPeriodStart, currentPeriodStart)),
      Item.find({}, "tags"),
      ActivityLog.find({})
        .populate("actorId", "name role")
        .sort({ createdAt: -1 })
        .limit(8),
    ]);

    const currentItems = await Item.countDocuments(getDateRange(currentPeriodStart, now));
    const currentLostItems = await Item.countDocuments({ ...getDateRange(currentPeriodStart, now), status: "lost" });
    const currentFoundItems = await Item.countDocuments({ ...getDateRange(currentPeriodStart, now), status: "found" });
    const currentUsers = await User.countDocuments({ ...getDateRange(currentPeriodStart, now), isBanned: false });
    const currentClaims = await Claim.countDocuments(getDateRange(currentPeriodStart, now));

    const tagCounts = {};
    items.forEach((item) => {
      item.tags.forEach((tagValue) => {
        const tag = tagValue.toLowerCase();
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    const mostUsedTags = Object.keys(tagCounts)
      .map((tag) => ({ tag, count: tagCounts[tag] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    res.json({
      overview: {
        totalItems: { value: totalItems, delta: currentItems - (previousItems || 0) },
        lostItems: { value: lostItems, delta: currentLostItems - (previousLostItems || 0) },
        foundItems: { value: foundItems, delta: currentFoundItems - (previousFoundItems || 0) },
        activeUsers: { value: activeUsers, delta: currentUsers - (previousUsers || 0) },
        totalClaims: { value: totalClaims, delta: currentClaims - (previousClaims || 0) },
      },
      weekActivity: {
        totalItems: currentItems,
        lostItems: currentLostItems,
        foundItems: currentFoundItems,
        activeUsers: currentUsers,
        totalClaims: currentClaims,
      },
      mostUsedTags,
      recentModerationActions,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getStats };
