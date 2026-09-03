const User = require("../models/User");

async function getUsers(req, res) {
  try {
    const users = await User.find({ _id: { $ne: req.user.id } })
      .select("_id username email")
      .sort({ username: 1 });

    res.json({ users });
  } catch (error) {
    console.error("Users error:", error);
    res.status(500).json({ message: "Could not load users" });
  }
}

module.exports = { getUsers };