// ========================================
// CRASH GUARD — keep process alive on unhandled errors
// ========================================

process.on("uncaughtException", (err) => {
  console.error("⚠️  Uncaught Exception (process kept alive):", err.message);
});

process.on("unhandledRejection", (reason) => {
  console.error("⚠️  Unhandled Rejection (process kept alive):", reason);
});

// ========================================
// ENVIRONMENT
// ========================================

require("dotenv").config();

// ========================================
// IMPORTS
// ========================================

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const http = require("http");
const jwt = require("jsonwebtoken");
const socketIO = require("socket.io");

// ========================================
// MODELS
// ========================================

const User = require("./models/User");
const Message = require("./models/Message");

// ========================================
// ROUTES
// ========================================

const authRoutes = require("./routes/auth");
const messagesRoutes = require("./routes/messageRoute");

// ========================================
// APP
// ========================================

const app = express();

const server =
  http.createServer(app);

// ========================================
// SOCKET.IO
// ========================================

const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },

  transports: [
    "polling",
    "websocket"
  ]
});


// ========================================
// CONFIG
// ========================================

const PORT =
  process.env.PORT || 4000;

const ROOM = "general";

// ========================================
// MIDDLEWARE
// ========================================

app.use(
  express.json()
);

app.use(
  express.urlencoded({
    extended: true,
  })
);

// ========================================
// STATIC PUBLIC FOLDER
// ========================================

app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    )
  )
);

// ========================================
// ROUTES
// ========================================

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/messages",
  messagesRoutes
);

// ========================================
// HEALTH CHECK
// ========================================

app.get(
  "/api/health",
  (req, res) => {
    const dbState = mongoose.connection.readyState;
    const dbStatus = ["disconnected", "connected", "connecting", "disconnecting"];
    res.json({
      success: true,
      message: "Server is running",
      socketIO: true,
      port: PORT,
      mongodb: dbStatus[dbState] || "unknown",
    });
  }
);

// ========================================
// CURRENT USER
// ========================================

app.get(
  "/api/me",
  async (req, res) => {
    try {
      const header =
        req.headers.authorization;

      if (
        !header ||
        !header.startsWith(
          "Bearer "
        )
      ) {
        return res.status(401).json({
          message:
            "Authentication required",
        });
      }

      const token =
        header.split(" ")[1];

      if (!token) {
        return res.status(401).json({
          message:
            "Token missing",
        });
      }

      const decoded =
        jwt.verify(
          token,
          process.env.JWT_SECRET
        );

      const user =
        await User.findById(
          decoded.id
        ).select(
          "_id username email"
        );

      if (!user) {
        return res.status(404).json({
          message:
            "User not found",
        });
      }

      return res.json({
        user: {
          id: user._id,
          username:
            user.username,
          email:
            user.email,
        },
      });

    } catch (error) {
      console.error(
        "ME error:",
        error.message
      );

      return res.status(401).json({
        message:
          "Invalid or expired token",
      });
    }
  }
);

// ========================================
// MONGODB
// ========================================

// ========================================
// MONGODB CONNECT WITH RETRY
// ========================================

function connectMongoDB(retries = 3, delay = 10000) {
  if (!process.env.MONGODB_URI) {
    console.error("❌ MONGODB_URI is missing in .env");
    return;
  }

  mongoose
    .connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 30000,
    })
    .then(() => {
      console.log("MongoDB connected ✅");
    })
    .catch((error) => {
      console.error("MongoDB connection error:", error.message);

      if (retries > 0) {
        console.log(
          `🔄 Retrying in ${delay / 1000}s... (${retries} attempt(s) left)`
        );
        setTimeout(() => connectMongoDB(retries - 1, delay), delay);
      } else {
        console.error(
          "❌ MongoDB unavailable. Server running without database — login/register will fail until DB is reachable."
        );
      }
    });
}

connectMongoDB();

// ========================================
// SOCKET.IO JWT AUTHENTICATION
// ========================================

io.use(
  async (socket, next) => {
    try {
      console.log(
        "🔐 Socket authentication..."
      );

      const token =
        socket.handshake.query?.token ||
        socket.handshake.auth?.token;

      // ----------------------------
      // TOKEN CHECK
      // ----------------------------

      if (!token) {
        console.error(
          "❌ Socket token missing"
        );

        return next(
          new Error(
            "Authentication required"
          )
        );
      }

      // ----------------------------
      // JWT VERIFY
      // ----------------------------

      if (!process.env.JWT_SECRET) {
        console.error(
          "❌ JWT_SECRET is missing"
        );

        return next(
          new Error(
            "Server authentication configuration error"
          )
        );
      }

      const decoded =
        jwt.verify(
          token,
          process.env.JWT_SECRET
        );

      console.log(
        "JWT verified for user:",
        decoded.id
      );

      // ----------------------------
      // FIND USER
      // ----------------------------

      const user =
        await User.findById(
          decoded.id
        ).select(
          "_id username email"
        );

      if (!user) {
        console.error(
          "❌ Socket user not found"
        );

        return next(
          new Error(
            "User not found"
          )
        );
      }

      // ----------------------------
      // SAVE USER TO SOCKET
      // ----------------------------

      socket.user = user;

      console.log(
        `✅ Socket authenticated: ${user.username}`
      );

      next();

    } catch (error) {
      console.error(
        "❌ Socket authentication error:",
        error.message
      );

      next(
        new Error(
          "Invalid or expired token"
        )
      );
    }
  }
);

// ========================================
// ONLINE USERS
// ========================================

// userId -> Set(socketId)

const onlineUsers =
  new Map();

// ========================================
// SEND ONLINE USERS
// ========================================

function broadcastOnlineUsers() {
  const userIds =
    Array.from(
      onlineUsers.keys()
    );

  io.emit(
    "online-users",
    userIds
  );

  console.log(
    "Online users:",
    userIds
  );
}

// ========================================
// SOCKET CONNECTION
// ========================================

io.on(
  "connection",
  (socket) => {
    const user =
      socket.user;

    const userId =
      String(user._id);

    console.log(
      "================================"
    );

    console.log(
      `✅ New authenticated client`
    );

    console.log(
      `Username: ${user.username}`
    );

    console.log(
      `User ID: ${userId}`
    );

    console.log(
      `Socket ID: ${socket.id}`
    );

    console.log(
      "================================"
    );

    // ====================================
    // ADD ONLINE USER
    // ====================================

    if (
      !onlineUsers.has(
        userId
      )
    ) {
      onlineUsers.set(
        userId,
        new Set()
      );
    }

    onlineUsers
      .get(userId)
      .add(socket.id);

    // ====================================
    // CURRENT USER
    // ====================================

    socket.emit(
      "current-user",
      {
        id: user._id,
        username:
          user.username,
        email:
          user.email,
      }
    );

    // ====================================
    // ONLINE USERS
    // ====================================

    broadcastOnlineUsers();

    // ====================================
    // JOIN ROOM
    // ====================================

    socket.on(
      "join-room",
      (room) => {
        try {
          const selectedRoom =
            String(
              room || ROOM
            );

          socket.join(
            selectedRoom
          );

          console.log(
            `${user.username} joined room: ${selectedRoom}`
          );

        } catch (error) {
          console.error(
            "Join room error:",
            error.message
          );
        }
      }
    );

    // ====================================
    // GROUP MESSAGE
    // ====================================

    socket.on(
      "message",
      async (data) => {
        try {
          const room =
            String(
              data?.room ||
              ROOM
            );

          const text =
            String(
              data?.message ||
              ""
            ).trim();

          if (!text) {
            return;
          }

          // Make sure user is in room
          socket.join(room);

          // ------------------------------
          // SAVE MESSAGE
          // ------------------------------

          const savedMessage =
            await Message.create({
              sender:
                user._id,

              receiver:
                null,

              room:
                room,

              message:
                text,
            });

          // ------------------------------
          // MESSAGE DATA
          // ------------------------------

          const messageData = {
            id:
              savedMessage._id,

            senderId:
              user._id,

            senderUsername:
              user.username,

            message:
              text,

            room:
              room,

            dateTime:
              savedMessage.createdAt,

            type:
              "group",
          };

          console.log(
            `📤 Group message from ${user.username}: ${text}`
          );

          // ------------------------------
          // SEND TO ROOM
          // ------------------------------

          io.to(room).emit(
            "message",
            messageData
          );

        } catch (error) {
          console.error(
            "❌ Group message error:",
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

    // ====================================
    // PRIVATE MESSAGE
    // ====================================

    socket.on(
      "private-message",
      async (data) => {
        try {
          const receiverId =
            String(
              data?.receiverId ||
              ""
            );

          const text =
            String(
              data?.message ||
              ""
            ).trim();

          if (
            !receiverId ||
            !text
          ) {
            return;
          }

          // ------------------------------
          // PREVENT SELF MESSAGE
          // ------------------------------

          if (
            receiverId ===
            userId
          ) {
            socket.emit(
              "chat-error",
              {
                message:
                  "You cannot message yourself",
              }
            );

            return;
          }

          // ------------------------------
          // FIND RECEIVER
          // ------------------------------

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

          // ------------------------------
          // SAVE MESSAGE
          // ------------------------------

          const savedMessage =
            await Message.create({
              sender:
                user._id,

              receiver:
                receiver._id,

              room:
                null,

              message:
                text,
            });

          // ------------------------------
          // MESSAGE DATA
          // ------------------------------

          const messageData = {
            id:
              savedMessage._id,

            senderId:
              user._id,

            senderUsername:
              user.username,

            receiverId:
              receiver._id,

            receiverUsername:
              receiver.username,

            message:
              text,

            dateTime:
              savedMessage.createdAt,

            type:
              "private",
          };

          console.log(
            `📤 Private message: ${user.username} -> ${receiver.username}`
          );

          // ------------------------------
          // SEND RECEIVER
          // ------------------------------

          const receiverSockets =
            onlineUsers.get(
              receiverId
            );

          if (
            receiverSockets
          ) {
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

          // ------------------------------
          // SEND BACK TO SENDER
          // ------------------------------

          socket.emit(
            "private-message",
            messageData
          );

        } catch (error) {
          console.error(
            "❌ Private message error:",
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

    // ====================================
    // GROUP TYPING
    // ====================================

    socket.on(
      "typing",
      (data) => {
        const room =
          String(
            data?.room ||
            ROOM
          );

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

    // ====================================
    // GROUP STOP TYPING
    // ====================================

    socket.on(
      "stop-typing",
      (data) => {
        const room =
          String(
            data?.room ||
            ROOM
          );

        socket
          .to(room)
          .emit(
            "stop-typing"
          );
      }
    );

    // ====================================
    // PRIVATE TYPING
    // ====================================

    socket.on(
      "private-typing",
      (data) => {
        const receiverId =
          String(
            data?.receiverId ||
            ""
          );

        if (!receiverId) {
          return;
        }

        const receiverSockets =
          onlineUsers.get(
            receiverId
          );

        if (
          !receiverSockets
        ) {
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

    // ====================================
    // PRIVATE STOP TYPING
    // ====================================

    socket.on(
      "private-stop-typing",
      (data) => {
        const receiverId =
          String(
            data?.receiverId ||
            ""
          );

        if (!receiverId) {
          return;
        }

        const receiverSockets =
          onlineUsers.get(
            receiverId
          );

        if (
          !receiverSockets
        ) {
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

    // ====================================
    // DISCONNECT
    // ====================================

    socket.on(
      "disconnect",
      (reason) => {
        console.log(
          "================================"
        );

        console.log(
          `❌ ${user.username} disconnected`
        );

        console.log(
          `Socket ID: ${socket.id}`
        );

        console.log(
          `Reason: ${reason}`
        );

        console.log(
          "================================"
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

        broadcastOnlineUsers();
      }
    );
  }
);

// ========================================
// START SERVER
// ========================================

server.listen(
  PORT,
  () => {
    console.log(
      "================================"
    );

    console.log(
      `💬 Server running on port ${PORT}`
    );

    console.log(
      `🌐 http://localhost:${PORT}`
    );

    console.log(
      `🔌 Socket.IO ready`
    );

    console.log(
      "================================"
    );
  }
);

// ========================================
// SERVER ERROR
// ========================================

server.on(
  "error",
  (error) => {
    console.error(
      "❌ Server error:",
      error
    );
  }
);