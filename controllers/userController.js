const User = require("../models/User");

// POST /users — Create a new user
const createUser = async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email)
      return res.status(400).json({ error: "Name and email are required" });

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) return res.status(200).json(user); // return existing user

    user = await User.create({ name, email });
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /users — Get all users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { createUser, getAllUsers };
