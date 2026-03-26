const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

// Load env variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes (to be added in next sections)
app.use("/users", require("./routes/userRoutes"));
app.use("/items", require("./routes/itemRoutes"));
app.use("/claims", require("./routes/claimRoutes"));

// Health check
app.get("/", (req, res) => {
  res.json({ message: "🔍 Back2You API is running!" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
