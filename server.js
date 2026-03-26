const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const http = require("http");
const { Server } = require("socket.io");

// Load env variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:3000"], // common Vite/CRA ports
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
  }
});

// Socket.io connection logic
io.on("connection", (socket) => {
  console.log("Connected to socket.io", socket.id);

  socket.on("setup", (userData) => {
    if (userData && userData._id) {
      socket.join(userData._id);
      socket.emit("connected");
      console.log(`User ${userData._id} joined their room`);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected", socket.id);
  });
});

// Pass io to routes via req.io
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes (to be added in next sections)
app.use("/auth", require("./routes/authRoutes"));
app.use("/users", require("./routes/userRoutes"));
app.use("/items", require("./routes/itemRoutes"));
app.use("/claims", require("./routes/claimRoutes"));
app.use("/notifications", require("./routes/notificationRoutes"));
app.use("/stats", require("./routes/statRoutes"));
app.use("/feedback", require("./routes/feedbackRoutes"));
app.use("/admin", require("./routes/adminRoutes"));

// Health check
app.get("/", (req, res) => {
  res.json({ message: "🔍 Back2You API is running!" });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
