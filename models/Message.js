const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    // ========================================
    // SENDER
    // ========================================

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    senderUsername: {
      type: String,
      required: true
    },

    // ========================================
    // RECEIVER
    // ========================================

    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    receiverUsername: {
      type: String,
      default: null
    },

    // ========================================
    // MESSAGE
    // ========================================

    message: {
      type: String,
      required: true,
      trim: true
    },

    // ========================================
    // MESSAGE TYPE
    // group / private
    // ========================================

    type: {
      type: String,
      enum: ["group", "private"],
      required: true
    },

    // ========================================
    // ROOM
    // ========================================

    room: {
      type: String,
      default: "general"
    },

    // ========================================
    // EDIT MESSAGE
    // ========================================

    edited: {
      type: Boolean,
      default: false
    },

    // ========================================
    // UNSEND / DELETE FOR EVERYONE
    // ========================================

    deleted: {
      type: Boolean,
      default: false
    },

    // ========================================
    // DELETE FOR ME
    // ========================================

    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ]
  },

  {
    timestamps: true
  }
);

// ========================================
// INDEXES
// ========================================

// Private chat
messageSchema.index({
  sender: 1,
  receiver: 1,
  createdAt: -1
});

// Group chat
messageSchema.index({
  type: 1,
  room: 1,
  createdAt: -1
});

// Deleted messages
messageSchema.index({
  deleted: 1,
  createdAt: -1
});

module.exports = mongoose.model(
  "Message",
  messageSchema
);