const socket = io()

const messageForm = document.getElementById('message-form')
const messageInput = document.getElementById('message-input')
const messageContainer = document.getElementById('message-container')
const nameInput = document.getElementById('name-input')
const clientTotal = document.getElementById('client-total')
const feedback = document.getElementById('feedback')
const recipientSelect = document.getElementById('recipient-select')

// Join chat
nameInput.addEventListener('change', () => {
  const name = nameInput.value.trim() || 'anonymous'

  socket.emit('join', name)
})

// Join automatically when page loads
socket.emit('join', nameInput.value.trim() || 'anonymous')

// Receive user list
socket.on('user-list', (users) => {
  recipientSelect.innerHTML = '<option value="">Select user</option>'

  users.forEach((user) => {
    // Don't show yourself
    if (user.id !== socket.id) {
      const option = document.createElement('option')

      option.value = user.id
      option.textContent = user.name

      recipientSelect.appendChild(option)
    }
  })
})

// Send private message
messageForm.addEventListener('submit', (e) => {
  e.preventDefault()

  const message = messageInput.value.trim()
  const name = nameInput.value.trim() || 'anonymous'
  const targetSocketId = recipientSelect.value

  if (message === '') return

  if (!targetSocketId) {
    alert('Please select a user')
    return
  }

  socket.emit('private-message', {
    targetSocketId,
    name,
    message,
  })

  messageInput.value = ''
  messageInput.focus()
})

// Receive private message
socket.on('private-message', (data) => {
  const messageElement = document.createElement('li')

  messageElement.classList.add('message-left')

  messageElement.innerHTML = `
    <p class="message">
      ${data.message}
      <span>${data.name}</span>
    </p>
  `

  messageContainer.appendChild(messageElement)
  messageContainer.scrollTop = messageContainer.scrollHeight
})

// Typing
messageInput.addEventListener('input', () => {
  socket.emit('typing', {
    name: nameInput.value.trim() || 'anonymous',
  })
})

// Receive typing
socket.on('typing', (data) => {
  feedback.textContent = `✍️ ${data.name} is typing...`

  setTimeout(() => {
    feedback.textContent = ''
  }, 1000)
})

// Total clients
socket.on('clients-total', (data) => {
  clientTotal.textContent = `Total clients: ${data}`
})