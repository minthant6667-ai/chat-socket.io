require("dotenv").config();

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const http = require("http");
const jwt = require("jsonwebtoken");
const socketIO = require("socket.io");

const User = require("./models/User");
const Message = require("./models/Message");

const authRoutes = require("./routes/auth");
const messagesRoutes = require("./routes/messageRoute");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 4000;
const ROOM = "general";

// ====================
// Middleware
// ====================

app.use(express.json());

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

// ====================
// Routes
// ====================

app.use("/api/auth", authRoutes);
app.use("/api/messages", messagesRoutes);

// ====================
// Current User
// ====================

app.get("/api/me", async (req, res) => {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const token = header.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const user = await User.findById(
      decoded.id
    ).select("_id username email");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error(
      "ME error:",
      error.message
    );

    res.status(401).json({
      message: "Invalid or expired token",
    });
  }
});

// ====================
// MongoDB
// ====================

mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  })
  .then(() => {
    console.log("MongoDB connected ✅");
  })
  .catch((error) => {
    console.error(
      "MongoDB connection error:",
      error.message
    );
  });

// ====================
// Socket.IO JWT
// ====================

io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token;

    if (!token) {
      return next(
        new Error("Authentication required")
      );
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const user = await User.findById(
      decoded.id
    ).select("_id username email");

    if (!user) {
      return next(
        new Error("User not found")
      );
    }

    socket.user = user;

    next();
  } catch (error) {
    console.error(
      "Socket authentication error:",
      error.message
    );

    next(
      new Error("Invalid or expired token")
    );
  }
});

// ====================
// Online Users
// ====================

const onlineUsers = new Map();

// userId -> Set(socketId)

// ====================
// Socket.IO Connection
// ====================

io.on("connection", (socket) => {
  const user = socket.user;
  const userId = String(user._id);

  console.log(
    `New authenticated client: ${user.username} - ${socket.id}`
  );

  // --------------------
  // Add Online User
  // --------------------

  if (!onlineUsers.has(userId)) {
    onlineUsers.set(
      userId,
      new Set()
    );
  }

  onlineUsers
    .get(userId)
    .add(socket.id);

  // --------------------
  // Current User
  // --------------------

  socket.emit("current-user", {
    id: user._id,
    username: user.username,
    email: user.email,
  });

  // --------------------
  // Online Users
  // --------------------

  io.emit(
    "online-users",
    Array.from(
      onlineUsers.keys()
    )
  );

  // ====================
  // Join Room
  // ====================

  socket.on(
    "join-room",
    (room) => {
      const selectedRoom =
        room || ROOM;

      socket.join(
        selectedRoom
      );

      console.log(
        `${user.username} joined room: ${selectedRoom}`
      );
    }
  );

  // ====================
  // Group Message
  // ====================

  socket.on(
    "message",
    async (data) => {
      try {
        const room =
          data.room || ROOM;

        const text = String(
          data.message || ""
        ).trim();

        if (!text) {
          return;
        }

        socket.join(room);

        // Save to MongoDB
        const savedMessage =
          await Message.create({
            sender: user._id,
            receiver: null,
            room: room,
            message: text,
          });

        const messageData = {
          id: savedMessage._id,
          senderId: user._id,
          senderUsername:
            user.username,
          message: text,
          room: room,
          dateTime:
            savedMessage.createdAt,
          type: "group",
        };

        // Send to everyone in room
        io.to(room).emit(
          "message",
          messageData
        );
      } catch (error) {
        console.error(
          "Group message error:",
          error.message
        );

        socket.emit(
          "chat-error",
          {
            message:
              "Could not save group message",
          }
        );
      }
    }
  );

  // ====================
  // Private Message
  // ====================

  socket.on(
    "private-message",
    async (data) => {
      try {
        const receiverId =
          String(
            data.receiverId || ""
          );

        const text = String(
          data.message || ""
        ).trim();

        if (!receiverId || !text) {
          return;
        }

        if (
          receiverId === userId
        ) {
          return;
        }

        // Find receiver
        const receiver =
          await User.findById(
            receiverId
          ).select(
            "_id username email"
          );

        if (!receiver) {
          socket.emit(
            "chat-error",
            {
              message:
                "Receiver not found",
            }
          );

          return;
        }

        // Save to MongoDB
        const savedMessage =
          await Message.create({
            sender: user._id,
            receiver:
              receiver._id,
            room: null,
            message: text,
          });

        const messageData = {
          id: savedMessage._id,

          senderId: user._id,
          senderUsername:
            user.username,

          receiverId:
            receiver._id,
          receiverUsername:
            receiver.username,

          message: text,

          dateTime:
            savedMessage.createdAt,

          type: "private",
        };

        // Send to receiver
        const receiverSockets =
          onlineUsers.get(
            receiverId
          );

        if (receiverSockets) {
          for (
            const socketId of
            receiverSockets
          ) {
            io.to(
              socketId
            ).emit(
              "private-message",
              messageData
            );
          }
        }

        // Send back to sender
        socket.emit(
          "private-message",
          messageData
        );
      } catch (error) {
        console.error(
          "Private message error:",
          error.message
        );

        socket.emit(
          "chat-error",
          {
            message:
              "Could not save private message",
          }
        );
      }
    }
  );

  // ====================
  // Group Typing
  // ====================

  socket.on(
    "typing",
    (data) => {
      const room =
        data.room || ROOM;

      socket
        .to(room)
        .emit(
          "typing",
          {
            username:
              user.username,
          }
        );
    }
  );

  // ====================
  // Group Stop Typing
  // ====================

  socket.on(
    "stop-typing",
    (data) => {
      const room =
        data.room || ROOM;

      socket
        .to(room)
        .emit(
          "stop-typing"
        );
    }
  );

  // ====================
  // Private Typing
  // ====================

  socket.on(
    "private-typing",
    (data) => {
      const receiverId =
        String(
          data.receiverId || ""
        );

      const receiverSockets =
        onlineUsers.get(
          receiverId
        );

      if (!receiverSockets) {
        return;
      }

      for (
        const socketId of
        receiverSockets
      ) {
        io.to(
          socketId
        ).emit(
          "private-typing",
          {
            senderId:
              user._id,
            username:
              user.username,
          }
        );
      }
    }
  );

  // ====================
  // Private Stop Typing
  // ====================

  socket.on(
    "private-stop-typing",
    (data) => {
      const receiverId =
        String(
          data.receiverId || ""
        );

      const receiverSockets =
        onlineUsers.get(
          receiverId
        );

      if (!receiverSockets) {
        return;
      }

      for (
        const socketId of
        receiverSockets
      ) {
        io.to(
          socketId
        ).emit(
          "private-stop-typing",
          {
            senderId:
              user._id,
          }
        );
      }
    }
  );

  // ====================
  // Disconnect
  // ====================

  socket.on(
    "disconnect",
    () => {
      console.log(
        `${user.username} disconnected`
      );

      const sockets =
        onlineUsers.get(
          userId
        );

      if (sockets) {
        sockets.delete(
          socket.id
        );

        if (
          sockets.size === 0
        ) {
          onlineUsers.delete(
            userId
          );
        }
      }

      io.emit(
        "online-users",
        Array.from(
          onlineUsers.keys()
        )
      );
    }
  );
});

// ====================
// Start Server
// ====================

server.listen(
  PORT,
  () => {
    console.log(
      `💬 server on port ${PORT}`
    );
  }
);