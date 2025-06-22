const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
  },
  sender: {
    type: String,
    enum: ["user", "bot", "agent"],
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  intent: {
    type: String,
    default: null,
  },
  confidence: {
    type: Number,
    default: 0,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
});

const conversationSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: false,
      index: true,
    },
    platform: {
      type: String,
      enum: ["web", "facebook", "telegram", "whatsapp"],
      default: "web",
    },
    status: {
      type: String,
      enum: ["active", "resolved", "escalated", "closed"],
      default: "active",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    category: {
      type: String,
      default: "general",
    },
    assignedAgent: {
      type: String,
      default: null,
    },
    messages: [messageSchema],
    startedAt: {
      type: Date,
      default: Date.now,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    satisfaction: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
conversationSchema.index({ sessionId: 1 });
conversationSchema.index({ userId: 1 });
conversationSchema.index({ status: 1 });
conversationSchema.index({ createdAt: -1 });
conversationSchema.index({ lastActivity: -1 });

// Update lastActivity when messages are added
conversationSchema.pre("save", function (next) {
  this.lastActivity = new Date();
  next();
});

module.exports = mongoose.model("Conversation", conversationSchema);
