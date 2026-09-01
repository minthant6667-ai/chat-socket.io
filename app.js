const authRoutes = require('./routes/auth')

app.use('/api/auth', authRoutes)
const User = require('./models/User')
require('dotenv').config()

const express = require('express')
const path = require('path')
const mongoose = require('mongoose')

const app = express()
const PORT = process.env.PORT || 4000

// Middleware
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  })
  .then(() => {
    console.log('MongoDB connected ✅')
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error.message)
  })

// Start server — ONLY ONCE
const server = app.listen(PORT, () => {
  console.log(`💬 server on port ${PORT}`)
})

// Socket.io — ONLY ONCE
const io = require('socket.io')(server)

let users = new Map()

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id)

  // User joins
  socket.on('join', (name) => {
    users.set(socket.id, name)

    console.log(`${name} joined: ${socket.id}`)

    io.emit(
      'user-list',
      Array.from(users).map(([id, name]) => ({
        id,
        name,
      }))
    )

    io.emit('clients-total', users.size)
  })

  // Private message
  socket.on('private-message', (data) => {
    const { targetSocketId, message, name } = data

    const senderName = users.get(socket.id) || name || 'anonymous'

    const privateMessage = {
      name: senderName,
      message,
    }

    io.to(targetSocketId).emit('private-message', privateMessage)

    socket.emit('private-message', privateMessage)
  })

  // Typing
  socket.on('typing', (data) => {
    socket.broadcast.emit('typing', data)
  })

  // Disconnect
  socket.on('disconnect', () => {
    const name = users.get(socket.id) || 'anonymous'

    users.delete(socket.id)

    console.log(`${name} disconnected`)

    io.emit(
      'user-list',
      Array.from(users).map(([id, name]) => ({
        id,
        name,
      }))
    )

    io.emit('clients-total', users.size)
  })
})