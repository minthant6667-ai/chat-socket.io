const express = require("express");

const { authMiddleware } = require("../middleware/auth");
const {
  getGroupMessages,
  getPrivateMessages,
} = require("../controllers/messageControllers");

const { getUsers } = require("../controllers/userControllers");

const router = express.Router();

// All message routes require JWT
router.use(authMiddleware);

// Get all users
router.get("/users", getUsers);

// Get group messages
router.get("/group", getGroupMessages);

// Get private messages
router.get("/private/:userId", getPrivateMessages);

module.exports = router;