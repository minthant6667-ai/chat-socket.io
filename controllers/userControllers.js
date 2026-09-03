const User = require("../models/User");

async function getUsers(req, res) {
  try {
    const users = await User.find()
      .select("_id username email")
      .sort({ username: 1 });

    res.json({
      users: users.map((user) => ({
        id: user._id,
        username: user.username,
        email: user.email,
      })),
    });
  } catch (error) {
    console.error("Get users error:", error);

    res.status(500).json({
      message: "Could not load users",
    });
  }
}

module.exports = {
  getUsers,
};