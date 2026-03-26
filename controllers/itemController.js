const Item = require("../models/Item");
const { uploadToCloudinary } = require("../utils/cloudinary");

// ─── Matching Algorithm ───────────────────────────────────────────────────────
const findMatches = async (newItem) => {
  const oppositeStatus = newItem.status === "lost" ? "found" : "lost";
  const candidates = await Item.find({ status: oppositeStatus });

  const matchesInfo = [];

  candidates.forEach((candidate) => {
    // Tag overlap
    const commonTags = newItem.tags.filter((tag) =>
      candidate.tags.map((t) => t.toLowerCase()).includes(tag.toLowerCase())
    );
    
    // Keyword overlap in titles
    const newWords = newItem.title.toLowerCase().split(/\s+/);
    const candidateWords = candidate.title.toLowerCase().split(/\s+/);
    const commonWords = newWords.filter((w) => candidateWords.includes(w) && w.length > 2);

    const totalFeatures = Math.max(newItem.tags.length + newWords.length, 1);
    const matchedFeatures = commonTags.length + commonWords.length;
    
    // Score out of 100
    let score = Math.round((matchedFeatures / totalFeatures) * 100);
    // Cap score at 100
    if (score > 100) score = 100;

    if (score > 0) {
      matchesInfo.push({
        item: candidate._id,
        score,
        commonTags,
      });
    }
  });

  return matchesInfo.sort((a, b) => b.score - a.score).slice(0, 5); // top 5
};

// ─── POST /items ──────────────────────────────────────────────────────────────
const createItem = async (req, res) => {
  try {
    const { title, description, status, tags, userId } = req.body;

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
      tags: parsedTags,
      userId,
    });

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

// ─── GET /items/search?q=bag ──────────────────────────────────────────────────
const searchItems = async (req, res) => {
  try {
    const { q, status } = req.query;
    if (!q) return res.status(400).json({ error: "Search query is required" });

    const keywords = q.toLowerCase().split(/\s+/).filter(Boolean);

    let items = await Item.find(status ? { status } : {})
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    // Filter: keyword matches tag OR title
    const results = items.filter((item) => {
      const tagMatch = item.tags.some((tag) =>
        keywords.some((word) => tag.toLowerCase().includes(word))
      );
      const titleMatch = keywords.some((word) =>
        item.title.toLowerCase().includes(word)
      );
      return tagMatch || titleMatch;
    });

    res.json(results);
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
