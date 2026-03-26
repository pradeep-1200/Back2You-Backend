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
      enum: ["lost", "found", "claimed", "resolved"],
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
    matchedItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolutionMessage: {
      type: String,
      default: "",
      trim: true,
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
