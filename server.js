require("dotenv").config();

const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messageRoutes");
const { authMiddleware } = require("./middleware/auth");
const User = require("./models/User");
const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => {
  res.json({ message: "Chat API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

app.get("/api/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({
      message: "Server error"
    });
  }
});

// ========================================
// ONLINE USERS
// ========================================

const onlineUsers = new Map();

function addOnlineUser(userId, socketId) {
  const key = String(userId);

  if (!onlineUsers.has(key)) {
    onlineUsers.set(key, new Set());
  }

  onlineUsers.get(key).add(socketId);
}

function removeOnlineUser(userId, socketId) {
  const key = String(userId);

  const sockets = onlineUsers.get(key);

  if (!sockets) return;

  sockets.delete(socketId);

  if (sockets.size === 0) {
    onlineUsers.delete(key);
  }
}

function getOnlineUserIds() {
  return [...onlineUsers.keys()];
}

function emitOnlineUsers() {
  io.emit("online-users", getOnlineUserIds());
}

function emitToUser(userId, event, data) {
  const sockets = onlineUsers.get(String(userId));

  if (!sockets) return;

  for (const socketId of sockets) {
    io.to(socketId).emit(event, data);
  }
}

// ========================================
// SOCKET AUTHENTICATION
// ========================================

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(
        new Error("Authentication required")
      );
    }

    const jwt = require("jsonwebtoken");

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const user = await User.findById(decoded.id)
      .select("-password");

    if (!user) {
      return next(
        new Error("User not found")
      );
    }

    socket.user = user;

    next();
  } catch (error) {
    next(
      new Error("Invalid or expired token")
    );
  }
});

// ========================================
// SOCKET CONNECTION
// ========================================

io.on("connection", (socket) => {
  const userId = String(socket.user._id);

  addOnlineUser(
    userId,
    socket.id
  );

  socket.join(`user:${userId}`);

  socket.emit("current-user", {
    id: socket.user._id,
    username: socket.user.username,
    email: socket.user.email
  });

  emitOnlineUsers();

  // ========================================
  // JOIN GROUP
  // ========================================

  socket.on(
    "join-room",
    (roomName = "general") => {
      socket.join(roomName);
    }
  );

  // ========================================
  // GROUP MESSAGE
  // ========================================

  socket.on("message", async (data) => {
    try {
      const text = String(
        data?.message || ""
      ).trim();

      const room = String(
        data?.room || "general"
      ).trim();

      if (!text) return;

      const savedMessage =
        await Message.create({
          sender: socket.user._id,
          senderUsername:
            socket.user.username,
          message: text,
          type: "group",
          room
        });

      const payload = {
        id: savedMessage._id,
        senderId: savedMessage.sender,
        senderUsername:
          savedMessage.senderUsername,
        message: savedMessage.message,
        type: savedMessage.type,
        room: savedMessage.room,
        dateTime:
          savedMessage.createdAt
      };

      io.to(room).emit(
        "message",
        payload
      );
    } catch (error) {
      console.error(error);

      socket.emit("chat-error", {
        message:
          "Could not save group message"
      });
    }
  });

  // ========================================
  // PRIVATE MESSAGE
  // ========================================

  socket.on(
    "private-message",
    async (data) => {
      try {
        const receiverId = String(
          data?.receiverId || ""
        ).trim();

        const text = String(
          data?.message || ""
        ).trim();

        if (!receiverId || !text) {
          return;
        }

        if (
          !mongoose.Types.ObjectId.isValid(
            receiverId
          )
        ) {
          return socket.emit(
            "chat-error",
            {
              message:
                "Invalid receiver"
            }
          );
        }

        const receiver =
          await User.findById(
            receiverId
          ).select("_id username");

        if (!receiver) {
          return socket.emit(
            "chat-error",
            {
              message:
                "Receiver not found"
            }
          );
        }

        const savedMessage =
          await Message.create({
            sender:
              socket.user._id,

            senderUsername:
              socket.user.username,

            receiver:
              receiver._id,

            receiverUsername:
              receiver.username,

            message: text,

            type: "private"
          });

        const payload = {
          id: savedMessage._id,

          senderId:
            savedMessage.sender,

          senderUsername:
            savedMessage.senderUsername,

          receiverId:
            savedMessage.receiver,

          receiverUsername:
            savedMessage.receiverUsername,

          message:
            savedMessage.message,

          type:
            savedMessage.type,

          dateTime:
            savedMessage.createdAt
        };

        // Send back to sender
        socket.emit(
          "private-message",
          payload
        );

        // Send to receiver
        emitToUser(
          receiver._id,
          "private-message",
          payload
        );
      } catch (error) {
        console.error(error);

        socket.emit(
          "chat-error",
          {
            message:
              "Could not save private message"
          }
        );
      }
    }
  );

  // ========================================
  // GROUP TYPING
  // ========================================

  socket.on(
    "typing",
    (data) => {
      const room = String(
        data?.room || "general"
      );

      socket.to(room).emit(
        "typing",
        {
          username:
            socket.user.username
        }
      );
    }
  );

  socket.on(
    "stop-typing",
    (data) => {
      const room = String(
        data?.room || "general"
      );

      socket.to(room).emit(
        "stop-typing"
      );
    }
  );

  // ========================================
  // PRIVATE TYPING
  // ========================================

  socket.on(
    "private-typing",
    (data) => {
      const receiverId = String(
        data?.receiverId || ""
      ).trim();

      if (!receiverId) return;

      emitToUser(
        receiverId,
        "private-typing",
        {
          senderId: userId,
          username:
            socket.user.username
        }
      );
    }
  );

  socket.on(
    "private-stop-typing",
    (data) => {
      const receiverId = String(
        data?.receiverId || ""
      ).trim();

      if (!receiverId) return;

      emitToUser(
        receiverId,
        "private-stop-typing",
        {
          senderId: userId
        }
      );
    }
  );

  // ========================================
  // DISCONNECT
  // ========================================

  socket.on(
    "disconnect",
    () => {
      removeOnlineUser(
        userId,
        socket.id
      );

      emitOnlineUsers();
    }
  );
});

// ========================================
// START SERVER
// ========================================

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error(
        "MONGODB_URI is missing in .env"
      );
    }

    if (!process.env.JWT_SECRET) {
      throw new Error(
        "JWT_SECRET is missing in .env"
      );
    }

    await mongoose.connect(
      process.env.MONGODB_URI
    );

    console.log("MongoDB connected");

    server.listen(
      PORT,
      () => {
        console.log(
          `Server running at http://localhost:${PORT}`
        );
      }
    );
  } catch (error) {
    console.error(
      "Server startup failed:",
      error.message
    );

    process.exit(1);
  }
}

startServer();