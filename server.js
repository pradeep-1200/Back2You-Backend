const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const http = require("http");
const { Server } = require("socket.io");

dotenv.config();

const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
];

const configuredOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOrigins = configuredOrigins.length ? configuredOrigins : defaultAllowedOrigins;

connectDB();

const app = express();
const server = http.createServer(app);

const isAllowedOrigin = (origin) => !origin || corsOrigins.includes(origin);

const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Socket.io CORS blocked for origin: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  },
});

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

app.set("trust proxy", 1);

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/auth", require("./routes/authRoutes"));
app.use("/users", require("./routes/userRoutes"));
app.use("/items", require("./routes/itemRoutes"));
app.use("/claims", require("./routes/claimRoutes"));
app.use("/notifications", require("./routes/notificationRoutes"));
app.use("/stats", require("./routes/statRoutes"));
app.use("/feedback", require("./routes/feedbackRoutes"));
app.use("/admin", require("./routes/adminRoutes"));

app.get("/", (req, res) => {
  res.json({
    service: "Back2You API",
    status: "ok",
    environment: process.env.NODE_ENV || "development",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
