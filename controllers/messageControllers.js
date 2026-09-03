const mongoose = require("mongoose");
const Message = require("../models/Message");

async function getGroupMessages(req, res) {
  try {
    const room = req.query.room || "general";

    const messages = await Message.find({
      room: room,
      receiver: null,
    })
      .populate("sender", "_id username email")
      .sort({ createdAt: 1 });

    res.json({
      messages: messages.map((message) => ({
        id: message._id,
        senderId: message.sender?._id,
        senderUsername: message.sender?.username,
        message: message.message,
        room: message.room,
        dateTime: message.createdAt,
        type: "group",
      })),
    });
  } catch (error) {
    console.error("Get group messages error:", error);

    res.status(500).json({
      message: "Could not load group messages",
      messages: [],
    });
  }
}

async function getPrivateMessages(req, res) {
  try {
    const currentUserId = req.user.id;
    const otherUserId = req.params.userId;

    if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
      return res.status(400).json({
        message: "Invalid user ID",
        messages: [],
      });
    }

    const messages = await Message.find({
      $or: [
        {
          sender: currentUserId,
          receiver: otherUserId,
        },
        {
          sender: otherUserId,
          receiver: currentUserId,
        },
      ],
    })
      .populate("sender", "_id username email")
      .populate("receiver", "_id username email")
      .sort({ createdAt: 1 });

    res.json({
      messages: messages.map((message) => ({
        id: message._id,

        senderId: message.sender?._id,
        senderUsername: message.sender?.username,

        receiverId: message.receiver?._id,
        receiverUsername: message.receiver?.username,

        message: message.message,
        dateTime: message.createdAt,
        type: "private",
      })),
    });
  } catch (error) {
    console.error("Get private messages error:", error);

    res.status(500).json({
      message: "Could not load private messages",
      messages: [],
    });
  }
}

module.exports = {
  getGroupMessages,
  getPrivateMessages,
};