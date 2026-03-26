const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("MongoDB connection failed.");
    console.error(`MONGO_URI: ${process.env.MONGO_URI}`);
    console.error(`Reason: ${error.message}`);
    console.error("Start MongoDB locally or update backend/.env with a reachable MongoDB URI.");
    process.exit(1);
  }
};

module.exports = connectDB;
