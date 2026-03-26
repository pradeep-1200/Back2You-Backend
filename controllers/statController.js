const Item = require("../models/Item");
const User = require("../models/User");
const Claim = require("../models/Claim");

// GET /stats
const getStats = async (req, res) => {
  try {
    const totalItems = await Item.countDocuments();
    const lostItems = await Item.countDocuments({ status: "lost" });
    const foundItems = await Item.countDocuments({ status: "found" });
    const totalUsers = await User.countDocuments();
    const totalClaims = await Claim.countDocuments();

    // Most used tags
    const items = await Item.find({}, "tags");
    const tagCounts = {};
    items.forEach(item => {
      item.tags.forEach(t => {
        const tag = t.toLowerCase();
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    const mostUsedTags = Object.keys(tagCounts)
      .map(tag => ({ tag, count: tagCounts[tag] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    res.json({
      totalItems,
      lostItems,
      foundItems,
      totalUsers,
      totalClaims,
      mostUsedTags
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getStats };
