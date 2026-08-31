const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const users = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Register user
  socket.on("register", (name) => {
    users[name] = socket.id;
    socket.username = name;

    console.log(`${name} registered`);
  });

  // One-to-one message
  socket.on("private message", ({ to, message }) => {
    const targetSocketId = users[to];

    if (!targetSocketId) {
      socket.emit("message error", {
        message: `${to} is not online`,
      });
      return;
    }

    // Send only to the receiver
    io.to(targetSocketId).emit("private message", {
      from: socket.username,
      message,
    });

    // Send back to sender
    socket.emit("private message", {
      from: socket.username,
      message,
    });
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      delete users[socket.username];
    }

    console.log("User disconnected:", socket.id);
  });
});

server.listen(4000, () => {
  console.log("Server running on http://localhost:4000");
});