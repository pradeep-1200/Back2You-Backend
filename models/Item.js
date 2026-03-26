const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["lost", "found"],
      required: [true, "Status is required"],
    },
    imageUrl: {
      type: String,
      default: "",
    },
    tags: {
      type: [String],
      default: [],
    },
    location: {
      type: String,
      default: "",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    matches: [
      {
        item: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
        score: Number,
        commonTags: [String],
        explanation: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Item", itemSchema);
