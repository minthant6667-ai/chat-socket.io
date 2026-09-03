const mongoose = require("mongoose");
const Message = require("../models/Message");

async function getGroupMessages(req, res) {
  try {
    const room = String(req.query.room || "general");

    const messages = await Message.find({
      type: "group",
      room
    })
      .sort({ createdAt: 1 })
      .limit(100);

    res.json({ messages });
  } catch (error) {
    console.error("Group history error:", error);
    res.status(500).json({ message: "Could not load group messages" });
  }
}

async function getPrivateMessages(req, res) {
  try {
    const otherUserId = String(req.params.userId);

    if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const myId = req.user.id;

    const messages = await Message.find({
      type: "private",
      $or: [
        { sender: myId, receiver: otherUserId },
        { sender: otherUserId, receiver: myId }
      ]
    })
      .sort({ createdAt: 1 })
      .limit(100);

    res.json({ messages });
  } catch (error) {
    console.error("Private history error:", error);
    res.status(500).json({ message: "Could not load private messages" });
  }
}

module.exports = { getGroupMessages, getPrivateMessages };