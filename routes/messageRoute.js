const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const {
  getGroupMessages,
  getPrivateMessages
} = require("../controllers/messageController");
const { getUsers } = require("../controllers/userController");

const router = express.Router();

router.use(authMiddleware);

router.get("/users", getUsers);
router.get("/group", getGroupMessages);
router.get("/private/:userId", getPrivateMessages);

module.exports = router;