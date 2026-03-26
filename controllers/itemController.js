const Item = require("../models/Item");
const { uploadToCloudinary } = require("../utils/cloudinary");

// ─── Matching Algorithm ───────────────────────────────────────────────────────
const findMatches = async (newItem) => {
  const oppositeStatus = newItem.status === "lost" ? "found" : "lost";
  const candidates = await Item.find({ status: oppositeStatus });

  const matchesInfo = [];

  candidates.forEach((candidate) => {
    // Fuzzy matching helpers
    const getWords = (str) => (str || "").toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const countOverlap = (arr1, arr2) => arr1.filter(w1 => arr2.some(w2 => w1.includes(w2) || w2.includes(w1))).length;

    // 1. Tags match (50%)
    const commonTags = newItem.tags.filter((t1) =>
      candidate.tags.some((t2) => t1.toLowerCase().includes(t2.toLowerCase()) || t2.toLowerCase().includes(t1.toLowerCase()))
    );
    const tagScore = newItem.tags.length ? (commonTags.length / Math.max(newItem.tags.length, candidate.tags.length)) * 50 : 0;

    // 2. Title match (30%)
    const newTitleWords = getWords(newItem.title);
    const candTitleWords = getWords(candidate.title);
    const titleOverlap = countOverlap(newTitleWords, candTitleWords);
    const titleScore = newTitleWords.length ? (titleOverlap / Math.max(newTitleWords.length, candTitleWords.length)) * 30 : 0;

    // 3. Description match (20%)
    const newDescWords = getWords(newItem.description);
    const candDescWords = getWords(candidate.description);
    const descOverlap = countOverlap(newDescWords, candDescWords);
    const descScore = newDescWords.length ? (descOverlap / Math.max(newDescWords.length, candDescWords.length)) * 20 : 0;

    const totalScore = Math.round(tagScore + titleScore + descScore);

    if (totalScore > 10) { // Minimum threshold
      let explanationParts = [];
      if (tagScore > 10) explanationParts.push("similar tags");
      if (titleScore > 10) explanationParts.push("matching title");
      if (descScore > 5) explanationParts.push("matching description");
      
      const explanation = explanationParts.length 
        ? `Matched because of ${explanationParts.join(" and ")}`
        : "Partial match found";

      matchesInfo.push({
        item: candidate._id,
        score: totalScore > 100 ? 100 : totalScore,
        commonTags,
        explanation
      });
    }
  });

  return matchesInfo.sort((a, b) => b.score - a.score).slice(0, 5); // top 5
};

// ─── POST /items ──────────────────────────────────────────────────────────────
const createItem = async (req, res) => {
  try {
    const { title, description, status, tags, userId, location } = req.body;

    if (!title || !status || !userId)
      return res.status(400).json({ error: "title, status, and userId are required" });

    let imageUrl = "";
    if (req.file) {
      imageUrl = await uploadToCloudinary(req.file.path);
    }

    // Parse tags (accept comma-separated string or array)
    const parsedTags =
      typeof tags === "string"
        ? tags.split(",").map((t) => t.trim()).filter(Boolean)
        : tags || [];

    const item = await Item.create({
      title,
      description,
      status,
      imageUrl,
      location,
      tags: parsedTags,
      userId,
    });

    // Add 5 points for reporting
    const User = require("../models/User");
    await User.findByIdAndUpdate(userId, { $inc: { points: 5 } });

    // Run matching algorithm
    const matchIds = await findMatches(item);
    item.matches = matchIds;
    await item.save();

    // Populate matches for immediate UI response
    const populatedItem = await Item.findById(item._id)
      .populate("matches.item", "title status tags imageUrl");

    res.status(201).json({ item: populatedItem, matchCount: matchIds.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── GET /items ───────────────────────────────────────────────────────────────
const getAllItems = async (req, res) => {
  try {
    const items = await Item.find()
      .populate("userId", "name email")
      .populate("matches.item", "title status tags imageUrl")
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── GET /items/search?q=bag&location=newyork&date=recently ────────────────
const searchItems = async (req, res) => {
  try {
    const { q, status, location, category, date } = req.query;
    
    // Build query object
    let query = {};
    if (status) query.status = status;
    
    // Handle date filtering
    if (date) {
      const currentDate = new Date();
      if (date === 'today') {
        currentDate.setHours(0,0,0,0);
        query.createdAt = { $gte: currentDate };
      } else if (date === 'week') {
        currentDate.setDate(currentDate.getDate() - 7);
        query.createdAt = { $gte: currentDate };
      } else if (date === 'month') {
        currentDate.setMonth(currentDate.getMonth() - 1);
        query.createdAt = { $gte: currentDate };
      }
    }

    let items = await Item.find(query)
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    // Apply location filtering
    if (location) {
      items = items.filter(item => 
        item.location && item.location.toLowerCase().includes(location.toLowerCase())
      );
    }

    // Apply category filtering (assuming categories are stored in tags)
    if (category) {
      items = items.filter(item => 
        item.tags.some(tag => tag.toLowerCase() === category.toLowerCase())
      );
    }

    // Apply keyword filtering
    if (q) {
      const keywords = q.toLowerCase().split(/\s+/).filter(Boolean);
      items = items.filter((item) => {
        const tagMatch = item.tags.some((tag) =>
          keywords.some((word) => tag.toLowerCase().includes(word))
        );
        const titleMatch = keywords.some((word) =>
          item.title.toLowerCase().includes(word)
        );
        const descMatch = keywords.some((word) =>
          item.description.toLowerCase().includes(word)
        );
        return tagMatch || titleMatch || descMatch;
      });
    }

    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── GET /items/:id ───────────────────────────────────────────────────────────
const getItemById = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
      .populate("userId", "name email")
      .populate("matches.item", "title status tags imageUrl createdAt");
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── GET /items/trending-tags ───────────────────────────────────────────────────
const getTrendingTags = async (req, res) => {
  try {
    const items = await Item.find({}, "tags");
    const tagCounts = {};
    items.forEach(item => {
      item.tags.forEach(t => {
        const tag = t.toLowerCase();
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    // Sort and get top 10
    const trending = Object.keys(tagCounts)
      .sort((a, b) => tagCounts[b] - tagCounts[a])
      .slice(0, 10);
      
    res.json(trending);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── GET /items/suggestions?q= ─────────────────────────────────────────────────
const getSuggestions = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    const items = await Item.find({}, "tags");
    const uniqueTags = new Set();
    
    items.forEach(item => {
      item.tags.forEach(t => {
        if (t.toLowerCase().includes(q.toLowerCase())) {
          uniqueTags.add(t.toLowerCase());
        }
      });
    });
    
    // Return top 5 suggestions
    res.json(Array.from(uniqueTags).slice(0, 5));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── GET /items/recent-activity ────────────────────────────────────────────────
const getRecentActivity = async (req, res) => {
  try {
    const items = await Item.find()
      .populate("userId", "name")
      .sort({ createdAt: -1 })
      .limit(8);
      
    const activity = items.map(i => ({
      _id: i._id,
      message: `${i.userId?.name || 'Anonymous'} reported a ${i.status} item: ${i.title}`,
      createdAt: i.createdAt,
      status: i.status
    }));
    
    res.json(activity);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { 
  createItem, 
  getAllItems, 
  searchItems, 
  getItemById,
  getTrendingTags,
  getSuggestions,
  getRecentActivity
};
