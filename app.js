const express = require('express')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 4000

const server = app.listen(PORT, () => {
  console.log(`💬 server on port ${PORT}`)
})

const io = require('socket.io')(server)

app.use(express.static(path.join(__dirname, 'public')))

let users = new Map()

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id)

  // User joins
  socket.on('join', (name) => {
    users.set(socket.id, name)

    console.log(`${name} joined: ${socket.id}`)

    // Send current users to everyone
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

    // Send ONLY to receiver
    io.to(targetSocketId).emit('private-message', privateMessage)

    // Send back ONLY to sender
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