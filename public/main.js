const socket = io()
const messageForm = document.getElementById('message-form')
const messageInput = document.getElementById('message-input')
const messageContainer = document.getElementById('message-container')
const nameInput = document.getElementById('name-input')
const clientTotal = document.getElementById('client-total')
const feedback = document.getElementById('feedback')
const recipientSelect = document.getElementById('recipient-select')

// နောက်ဆုံး ကိုယ်ကိုယ်တိုင် ပို့လိုက်တဲ့ မက်ဆေ့ချ်ကို မှတ်ထားရန် variable များ
let lastSentMessage = ''
let lastSentName = ''

// ==============================
// JOIN CHAT (With a warm hello)
// ==============================
function joinChat() {
  const name = nameInput.value.trim() || 'sweet anonymous'
  socket.emit('join', name)
}

// Join automatically
joinChat()

// Change username gracefully
nameInput.addEventListener('change', () => {
  joinChat()
})

// ==============================
// RECEIVE USER LIST
// ==============================
socket.on('user-list', (users) => {
  // Clear list and add a welcoming placeholder
  recipientSelect.innerHTML = '<option value="">Choose someone special...</option>'

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

// ==============================
// SEND PRIVATE MESSAGE
// ==============================
messageForm.addEventListener('submit', (e) => {
  e.preventDefault()

  const message = messageInput.value.trim()
  const name = nameInput.value.trim() || 'sweet anonymous'
  const targetSocketId = recipientSelect.value

  if (message === '') {
    return
  }

  // Ensure a gentle recipient is chosen
  if (!targetSocketId) {
    alert('Please pick a wonderful person to message first! 💕')
    return
  }

  // ကိုယ်ပို့လိုက်တဲ့ စာနဲ့ အမည်ကို ခေတ္တမှတ်ထားမယ်
  lastSentMessage = message
  lastSentName = name

  // Send loving payload to the server
  socket.emit('private-message', {
    targetSocketId,
    name,
    message
  })

  // Show YOUR message on RIGHT with love
  addMessageToUI(true, {
    name,
    message
  })

  messageInput.value = ''
  messageInput.focus()
})

// ==============================
// RECEIVE PRIVATE MESSAGE
// ==============================
socket.on('private-message', (data) => {
  // တကယ်လို့ Server ဘက်ကနေ ကိုယ့်ဆီကို အဲဒီစာပဲ ပြန်ရောက်လာခဲ့ရင် ဘယ်ဘက်မှာ လมาမပြတော့ပါ
  if (data.message === lastSentMessage && data.name === lastSentName) {
    return
  }

  // Show OTHER user's sweet message on LEFT
  addMessageToUI(false, data)
})

// ==============================
// ADD MESSAGE TO UI
// ==============================
function addMessageToUI(isOwnMessage, data) {
  const messageElement = document.createElement('li')

  if (isOwnMessage) {
    messageElement.classList.add('message-right')
  } else {
    messageElement.classList.add('message-left')
  }

  messageElement.innerHTML = `
    <p class="message">
      ✨ ${data.message}
      <span>${data.name}</span>
    </p>
  `

  messageContainer.appendChild(messageElement)
  messageContainer.scrollTop = messageContainer.scrollHeight
}

// ==============================
// TYPING
// ==============================
messageInput.addEventListener('input', () => {
  socket.emit('typing', {
    name: nameInput.value.trim() || 'sweet anonymous'
  })
})

// ==============================
// RECEIVE TYPING
// ==============================
socket.on('typing', (data) => {
  feedback.textContent = `💌 ${data.name} is crafting a sweet note...`

  setTimeout(() => {
    feedback.textContent = ''
  }, 1000)
})

// ==============================
// TOTAL CLIENTS
// ==============================
socket.on('clients-total', (data) => {
  clientTotal.textContent = `💖 Hearts connected: ${data}`
})