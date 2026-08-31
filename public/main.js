const socket = io()

const clientsTotal = document.getElementById('client-total')

const messageContainer = document.getElementById('message-container')
const nameInput = document.getElementById('name-input')
const messageForm = document.getElementById('message-form')
const messageInput = document.getElementById('message-input')

const messageTone = new Audio('/message-tone.mp3')

// Send message when form is submitted
messageForm.addEventListener('submit', (e) => {
e.preventDefault()
sendMessage()
})

// Update total clients
socket.on('clients-total', (data) => {
clientsTotal.innerText = `Total Clients: ${data}`
})

// Send message
function sendMessage() {
const message = messageInput.value.trim()

if (!message) return

const data = {
name: nameInput.value.trim() || 'anonymous',
message: message,
dateTime: new Date(),
}

socket.emit('message', data)
addMessageToUI(true, data)

messageInput.value = ''
messageInput.focus()
}

// Receive message from another client
socket.on('chat-message', (data) => {
messageTone.play().catch(() => {})
addMessageToUI(false, data)
})

// Add message to UI
function addMessageToUI(isOwnMessage, data) {
clearFeedback()

const element = `     <li class="${isOwnMessage ? 'message-right' : 'message-left'}">       <p class="message">
        ${data.message}         <span>${data.name} ● ${moment(data.dateTime).fromNow()}</span>       </p>     </li>
  `

messageContainer.innerHTML += element

scrollToBottom()
}

// Scroll to the latest message
function scrollToBottom() {
messageContainer.scrollTo({
top: messageContainer.scrollHeight,
behavior: 'smooth',
})
}

// Show typing feedback
function sendTypingFeedback() {
const name = nameInput.value.trim() || 'anonymous'

socket.emit('feedback', {
feedback: `✍️ ${name} is typing a message`,
})
}

// Message input focus
messageInput.addEventListener('focus', () => {
sendTypingFeedback()
})

// Message input typing
messageInput.addEventListener('input', () => {
if (messageInput.value.trim()) {
sendTypingFeedback()
} else {
socket.emit('feedback', {
feedback: '',
})
}
})

// Message input blur
messageInput.addEventListener('blur', () => {
socket.emit('feedback', {
feedback: '',
})
})

// Receive typing feedback
socket.on('feedback', (data) => {
clearFeedback()

if (!data.feedback) return

const element = `     <li class="message-feedback">       <p class="feedback" id="feedback">${data.feedback}</p>     </li>
  `

messageContainer.innerHTML += element

scrollToBottom()
})

// Clear typing feedback
function clearFeedback() {
document
.querySelectorAll('li.message-feedback')
.forEach((element) => {
element.remove()
})
}
