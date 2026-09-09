
// ========================================
// DOM ELEMENTS
// ========================================

const authSection = document.getElementById("auth-section");
const chatSection = document.getElementById("chat-section");

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

const authMessage = document.getElementById("auth-message");

const currentUserElement =
  document.getElementById("current-user");

const logoutButton =
  document.getElementById("logout-btn");

const groupChatButton =
  document.getElementById("group-chat-btn");

const usersList =
  document.getElementById("users-list");

const chatTitle =
  document.getElementById("chat-title");

const clientTotal =
  document.getElementById("clients-total");

const messageForm =
  document.getElementById("message-form");

const messageInput =
  document.getElementById("message-input");

const messageContainer =
  document.getElementById("message-container");

const feedback =
  document.getElementById("feedback");

const socketStatus =
  document.getElementById("socket-status");

// ========================================
// CONFIG
// ========================================

const API = "/api";
const SOCKET_URL = window.location.origin;
const ROOM = "general";

// ========================================
// STATE
// ========================================

let token = localStorage.getItem("chat_token");

let currentUser = null;
let selectedUser = null;
let socket = null;
let typingTimer = null;

// ========================================
// UNREAD COUNTS
// ========================================

const unreadMessages = {};
let groupUnread = 0;

// ========================================
// SAFE DOM CHECK
// ========================================

console.log("DOM check:", {
  authSection: !!authSection,
  chatSection: !!chatSection,
  loginForm: !!loginForm,
  registerForm: !!registerForm,
  authMessage: !!authMessage,
  currentUserElement: !!currentUserElement,
  logoutButton: !!logoutButton,
  groupChatButton: !!groupChatButton,
  usersList: !!usersList,
  chatTitle: !!chatTitle,
  clientTotal: !!clientTotal,
  messageForm: !!messageForm,
  messageInput: !!messageInput,
  messageContainer: !!messageContainer,
  feedback: !!feedback,
  socketStatus: !!socketStatus
});

// ========================================
// REGISTER
// ========================================

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const usernameInput =
      document.getElementById("register-username");

    const emailInput =
      document.getElementById("register-email");

    const passwordInput =
      document.getElementById("register-password");

    if (
      !usernameInput ||
      !emailInput ||
      !passwordInput
    ) {
      console.error(
        "Register input elements are missing"
      );

      return;
    }

    const body = {
      username: usernameInput.value.trim(),
      email: emailInput.value.trim(),
      password: passwordInput.value,
    };

    await authenticate(
      "/auth/register",
      body
    );
  });
}

// ========================================
// LOGIN
// ========================================

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const emailInput =
      document.getElementById("login-email");

    const passwordInput =
      document.getElementById("login-password");

    if (
      !emailInput ||
      !passwordInput
    ) {
      console.error(
        "Login input elements are missing"
      );

      return;
    }

    const body = {
      email: emailInput.value.trim(),
      password: passwordInput.value,
    };

    await authenticate(
      "/auth/login",
      body
    );
  });
}

// ========================================
// AUTHENTICATE
// ========================================

async function authenticate(endpoint, body) {
  if (!authMessage) {
    return;
  }

  authMessage.textContent = "Please wait...";

  try {
    const response = await fetch(
      API + endpoint,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      authMessage.textContent =
        data.message ||
        "Authentication failed";

      return;
    }

    if (!data.token || !data.user) {
      authMessage.textContent =
        "Invalid server response";

      return;
    }

    token = data.token;

    currentUser = {
      id: data.user.id,
      username: data.user.username,
      email: data.user.email,
    };

    localStorage.setItem(
      "chat_token",
      token
    );

    localStorage.setItem(
      "chat_user",
      JSON.stringify(currentUser)
    );

    authMessage.textContent = "";

    await startChat();

  } catch (error) {
    console.error(
      "Authentication error:",
      error
    );

    authMessage.textContent =
      "Cannot connect to server";
  }
}

// ========================================
// START CHAT
// ========================================

async function startChat() {
  if (!token || !currentUser) {
    console.error(
      "Cannot start chat: missing token or user"
    );

    return;
  }

  if (authSection) {
    authSection.classList.add("hidden");
  }

  if (chatSection) {
    chatSection.classList.remove("hidden");
  }

  if (currentUserElement) {
    currentUserElement.textContent =
      `${currentUser.username} (${currentUser.email})`;
  }

  connectSocket();

  await loadUsers();

  await selectGroupChat();
}

// ========================================
// CONNECT SOCKET.IO
// ========================================

function connectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  console.log("================================");
  console.log("🔌 Connecting to Socket.IO");
  console.log("Socket URL:", SOCKET_URL);
  console.log("Token exists:", !!token);
  console.log("================================");

  if (typeof io !== "function") {
    console.error(
      "Socket.IO client is not loaded."
    );

    if (socketStatus) {
      socketStatus.textContent =
        "Socket.IO client not loaded ❌";
    }

    return;
  }

  socket = io(SOCKET_URL, {
    query: {
      token: token,
    },

    transports: [
      "polling",
      "websocket",
    ],

    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  // ======================================
  // CONNECTED
  // ======================================

  socket.on("connect", () => {
    console.log("================================");
    console.log("✅ Socket.IO connected");
    console.log("Socket ID:", socket.id);
    console.log("Connected:", socket.connected);
    console.log("================================");

    if (socketStatus) {
      socketStatus.textContent =
        "Socket connected ✅";

      socketStatus.classList.add(
        "connected"
      );
    }

    hideTyping();

    socket.emit(
      "join-room",
      ROOM
    );

    console.log(
      "Joined room:",
      ROOM
    );
  });

  // ======================================
  // CONNECTION ERROR
  // ======================================

  socket.on(
    "connect_error",
    (error) => {
      console.error(
        "================================"
      );

      console.error(
        "❌ Socket.IO connection error"
      );

      console.error(
        "Message:",
        error.message
      );

      console.error(
        "Error:",
        error
      );

      console.error(
        "================================"
      );

      if (socketStatus) {
        socketStatus.textContent =
          `Socket error: ${error.message}`;

        socketStatus.classList.remove(
          "connected"
        );
      }

      if (feedback) {
        feedback.textContent =
          `Socket error: ${error.message}`;
      }
    }
  );

  // ======================================
  // DISCONNECTED
  // ======================================

  socket.on(
    "disconnect",
    (reason) => {
      console.log(
        "❌ Socket disconnected:",
        reason
      );

      if (clientTotal) {
        clientTotal.textContent =
          "0 online";
      }

      if (socketStatus) {
        socketStatus.textContent =
          "Socket is not connected ❌";

        socketStatus.classList.remove(
          "connected"
        );
      }

      if (
        reason !==
        "io client disconnect"
      ) {
        if (feedback) {
          feedback.textContent =
            "Socket disconnected ❌ Reconnecting...";
        }
      }
    }
  );

  // ======================================
  // RECONNECT
  // ======================================

  socket.io.on(
    "reconnect_attempt",
    (attempt) => {
      console.log(
        `🔄 Socket reconnect attempt: ${attempt}`
      );
    }
  );

  socket.io.on(
    "reconnect",
    (attempt) => {
      console.log(
        `✅ Socket reconnected after ${attempt} attempt(s)`
      );
    }
  );

  // ======================================
  // CURRENT USER
  // ======================================

  socket.on(
    "current-user",
    (user) => {
      console.log(
        "Current user:",
        user
      );

      if (!user) {
        return;
      }

      currentUser = {
        id: user.id,
        username: user.username,
        email: user.email,
      };

      localStorage.setItem(
        "chat_user",
        JSON.stringify(currentUser)
      );

      if (currentUserElement) {
        currentUserElement.textContent =
          `${user.username} (${user.email})`;
      }
    }
  );

  // ======================================
  // ONLINE USERS
  // ======================================

  socket.on(
    "online-users",
    (userIds) => {
      console.log(
        "Online users:",
        userIds
      );

      if (!Array.isArray(userIds)) {
        return;
      }

      if (clientTotal) {
        clientTotal.textContent =
          `${userIds.length} online`;
      }

      updateOnlineIndicators(
        userIds
      );
    }
  );

  // ======================================
  // GROUP MESSAGE
  // ======================================

  socket.on(
    "message",
    (data) => {
      console.log(
        "📨 Group message received:",
        data
      );

      if (
        selectedUser === null &&
        data.room === ROOM
      ) {
        renderMessage(data);
        return;
      }

      if (data.room === ROOM) {
        increaseGroupUnread();
      }
    }
  );

  // ======================================
  // PRIVATE MESSAGE
  // ======================================

  socket.on(
    "private-message",
    (data) => {
      console.log(
        "📨 Private message received:",
        data
      );

      if (!currentUser) {
        return;
      }

      const senderId =
        String(data.senderId);

      const myId =
        String(currentUser.id);

      // ====================================
      // MY OWN MESSAGE
      // ====================================

      if (senderId === myId) {
        if (
          selectedUser &&
          String(selectedUser.id) ===
            String(data.receiverId)
        ) {
          renderMessage(data);
        }

        return;
      }

      // ====================================
      // OPEN PRIVATE CHAT
      // ====================================

      if (
        selectedUser &&
        String(selectedUser.id) ===
          senderId
      ) {
        renderMessage(data);
        return;
      }

      // ====================================
      // PRIVATE CHAT NOT OPEN
      // ====================================

      increaseUnread(
        senderId
      );
    }
  );

  // ======================================
  // GROUP TYPING
  // ======================================

  socket.on(
    "typing",
    (data) => {
      if (
        selectedUser === null &&
        data
      ) {
        showTyping(
          data.username
        );
      }
    }
  );

  socket.on(
    "stop-typing",
    () => {
      if (
        selectedUser === null
      ) {
        hideTyping();
      }
    }
  );

  // ======================================
  // PRIVATE TYPING
  // ======================================

  socket.on(
    "private-typing",
    (data) => {
      if (
        selectedUser &&
        String(selectedUser.id) ===
          String(data.senderId)
      ) {
        showTyping(
          data.username
        );
      }
    }
  );

  socket.on(
    "private-stop-typing",
    (data) => {
      if (
        selectedUser &&
        String(selectedUser.id) ===
          String(data.senderId)
      ) {
        hideTyping();
      }
    }
  );

  // ======================================
  // CHAT ERROR
  // ======================================

  socket.on(
    "chat-error",
    (data) => {
      console.error(
        "❌ Chat error:",
        data
      );

      if (feedback) {
        feedback.textContent =
          data?.message ||
          "Chat error";
      }
    }
  );
}

// ========================================
// LOAD USERS
// ========================================

async function loadUsers() {
  if (!usersList || !currentUser) {
    return;
  }

  try {
    const response =
      await authFetch(
        "/messages/users"
      );

    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        "Load users error:",
        data.message
      );

      return;
    }

    usersList.innerHTML = "";

    for (
      const user of
      data.users || []
    ) {
      if (
        String(user.id) ===
        String(currentUser.id)
      ) {
        continue;
      }

      createUserButton(user);
    }

  } catch (error) {
    console.error(
      "Load users error:",
      error
    );
  }
}

// ========================================
// CREATE USER BUTTON
// ========================================

function createUserButton(user) {
  if (!usersList) {
    return;
  }

  const button =
    document.createElement(
      "button"
    );

  button.type = "button";
  button.className =
    "user-button";

  button.dataset.userId =
    String(user.id);

  button.innerHTML = `
    <div class="user-info">

      <span
        class="online-dot"
        data-online-for="${user.id}"
      ></span>

      <span class="username">
        ${escapeHtml(
          user.username
        )}
      </span>

    </div>

    <span
      class="unread-count hidden"
      data-unread-for="${user.id}"
    ></span>
  `;

  button.addEventListener(
    "click",
    () => {
      selectPrivateChat(user);
    }
  );

  usersList.appendChild(
    button
  );
}

// ========================================
// GROUP CHAT
// ========================================

async function selectGroupChat() {
  selectedUser = null;

  clearGroupUnread();

  if (groupChatButton) {
    groupChatButton.classList.add(
      "active"
    );
  }

  document
    .querySelectorAll(
      ".user-button"
    )
    .forEach((button) => {
      button.classList.remove(
        "active"
      );
    });

  if (chatTitle) {
    chatTitle.textContent =
      "General Group";
  }

  hideTyping();

  if (messageContainer) {
    messageContainer.innerHTML = "";
  }

  try {
    const response =
      await authFetch(
        `/messages/group?room=${encodeURIComponent(
          ROOM
        )}`
      );

    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        "Group messages error:",
        data.message
      );

      return;
    }

    for (
      const message of
      data.messages || []
    ) {
      renderMessage({
        id: message.id,
        senderId:
          message.senderId,
        senderUsername:
          message.senderUsername,
        message:
          message.message,
        room:
          message.room,
        dateTime:
          message.dateTime,
        type: "group",
      });
    }

  } catch (error) {
    console.error(
      "Group chat error:",
      error
    );
  }
}

// ========================================
// PRIVATE CHAT
// ========================================

async function selectPrivateChat(
  user
) {
  selectedUser = user;

  if (groupChatButton) {
    groupChatButton.classList.remove(
      "active"
    );
  }

  document
    .querySelectorAll(
      ".user-button"
    )
    .forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.userId ===
          String(user.id)
      );
    });

  if (chatTitle) {
    chatTitle.textContent =
      `Private chat with ${user.username}`;
  }

  hideTyping();

  if (messageContainer) {
    messageContainer.innerHTML = "";
  }

  clearUnread(
    user.id
  );

  try {
    const response =
      await authFetch(
        `/messages/private/${user.id}`
      );

    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        "Private messages error:",
        data.message
      );

      return;
    }

    for (
      const message of
      data.messages || []
    ) {
      renderMessage({
        id: message.id,
        senderId:
          message.senderId,
        senderUsername:
          message.senderUsername,
        receiverId:
          message.receiverId,
        receiverUsername:
          message.receiverUsername,
        message:
          message.message,
        dateTime:
          message.dateTime,
        type: "private",
      });
    }

  } catch (error) {
    console.error(
      "Private chat error:",
      error
    );
  }
}

// ========================================
// GROUP BUTTON
// ========================================

if (groupChatButton) {
  groupChatButton.addEventListener(
    "click",
    selectGroupChat
  );
}

// ========================================
// SEND MESSAGE
// ========================================

if (messageForm) {
  messageForm.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();

      console.log(
        "================================"
      );

      console.log(
        "🖱️ SEND BUTTON CLICKED"
      );

      const text =
        messageInput?.value.trim();

      console.log(
        "Message:",
        text
      );

      console.log(
        "Socket:",
        socket
      );

      console.log(
        "Socket connected:",
        socket?.connected
      );

      console.log(
        "Selected user:",
        selectedUser
      );

      console.log(
        "================================"
      );

      if (!text) {
        return;
      }

      if (
        !socket ||
        !socket.connected
      ) {
        console.error(
          "❌ Socket is NOT connected"
        );

        if (feedback) {
          feedback.textContent =
            "Socket is not connected ❌";
        }

        return;
      }

      // ====================================
      // PRIVATE MESSAGE
      // ====================================

      if (selectedUser) {
        console.log(
          "📤 Sending private message"
        );

        console.log(
          "Receiver ID:",
          selectedUser.id
        );

        socket.emit(
          "private-message",
          {
            receiverId:
              selectedUser.id,

            message:
              text,
          }
        );

        socket.emit(
          "private-stop-typing",
          {
            receiverId:
              selectedUser.id,
          }
        );
      }

      // ====================================
      // GROUP MESSAGE
      // ====================================

      else {
        console.log(
          "📤 Sending group message"
        );

        console.log(
          "Room:",
          ROOM
        );

        socket.emit(
          "message",
          {
            room: ROOM,
            message: text,
          }
        );

        socket.emit(
          "stop-typing",
          {
            room: ROOM,
          }
        );
      }

      if (messageInput) {
        messageInput.value = "";
      }

      hideTyping();
    }
  );
}

// ========================================
// TYPING
// ========================================

if (messageInput) {
  messageInput.addEventListener(
    "input",
    () => {
      if (
        !socket ||
        !socket.connected
      ) {
        return;
      }

      clearTimeout(
        typingTimer
      );

      // ==================================
      // PRIVATE TYPING
      // ==================================

      if (selectedUser) {
        socket.emit(
          "private-typing",
          {
            receiverId:
              selectedUser.id,
          }
        );

        typingTimer =
          setTimeout(
            () => {
              if (
                socket &&
                socket.connected &&
                selectedUser
              ) {
                socket.emit(
                  "private-stop-typing",
                  {
                    receiverId:
                      selectedUser.id,
                  }
                );
              }
            },
            900
          );

        return;
      }

      // ==================================
      // GROUP TYPING
      // ==================================

      socket.emit(
        "typing",
        {
          room: ROOM,
        }
      );

      typingTimer =
        setTimeout(
          () => {
            if (
              socket &&
              socket.connected
            ) {
              socket.emit(
                "stop-typing",
                {
                  room: ROOM,
                }
              );
            }
          },
          900
        );
    }
  );
}

// ========================================
// TYPING UI
// ========================================

function showTyping(
  username
) {
  if (!feedback) {
    return;
  }

  feedback.innerHTML = `
    <span class="typing-text">
      ${escapeHtml(
        username
      )}
      is typing...
      <span class="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </span>
    </span>
  `;
}

function hideTyping() {
  if (feedback) {
    feedback.textContent = "";
  }
}

// ========================================
// PRIVATE UNREAD
// ========================================

function increaseUnread(
  userId
) {
  const id =
    String(userId);

  unreadMessages[id] =
    (unreadMessages[id] || 0) + 1;

  updateUnreadUI(id);
}

function clearUnread(
  userId
) {
  const id =
    String(userId);

  unreadMessages[id] = 0;

  updateUnreadUI(id);
}

function updateUnreadUI(
  userId
) {
  const id =
    String(userId);

  const element =
    document.querySelector(
      `[data-unread-for="${id}"]`
    );

  if (!element) {
    return;
  }

  const count =
    unreadMessages[id] || 0;

  if (count <= 0) {
    element.textContent = "";

    element.classList.add(
      "hidden"
    );

    return;
  }

  element.classList.remove(
    "hidden"
  );

  element.textContent =
    `${count} new message${
      count > 1 ? "s" : ""
    } 🔴`;
}

// ========================================
// GROUP UNREAD
// ========================================

function increaseGroupUnread() {
  groupUnread++;

  updateGroupUnreadUI();
}

function updateGroupUnreadUI() {
  if (!groupChatButton) {
    return;
  }

  let element =
    document.getElementById(
      "group-unread"
    );

  if (!element) {
    element =
      document.createElement(
        "span"
      );

    element.id =
      "group-unread";

    groupChatButton.appendChild(
      element
    );
  }

  if (groupUnread <= 0) {
    element.textContent = "";

    element.classList.add(
      "hidden"
    );

    return;
  }

  element.classList.remove(
    "hidden"
  );

  element.textContent =
    ` ${groupUnread} new message${
      groupUnread > 1 ? "s" : ""
    } 🔴`;
}

function clearGroupUnread() {
  groupUnread = 0;

  updateGroupUnreadUI();
}

// ========================================
// RENDER MESSAGE
// ========================================

function renderMessage(
  data
) {
  if (
    !currentUser ||
    !messageContainer
  ) {
    return;
  }

  const mine =
    String(data.senderId) ===
    String(currentUser.id);

  const row =
    document.createElement(
      "div"
    );

  row.className =
    `message ${mine ? "mine" : "other"}`;

  const sender =
    document.createElement(
      "div"
    );

  sender.className =
    "message-sender";

  sender.textContent =
    mine
      ? "You"
      : data.senderUsername ||
        "User";

  const text =
    document.createElement(
      "div"
    );

  text.className =
    "message-text";

  text.textContent =
    data.message || "";

  const time =
    document.createElement(
      "div"
    );

  time.className =
    "message-time";

  time.textContent =
    formatDate(
      data.dateTime
    );

  row.appendChild(sender);
  row.appendChild(text);
  row.appendChild(time);

  messageContainer.appendChild(
    row
  );

  messageContainer.scrollTop =
    messageContainer.scrollHeight;
}

// ========================================
// DATE
// ========================================

function formatDate(
  value
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleString();
}

// ========================================
// ONLINE INDICATORS
// ========================================

function updateOnlineIndicators(
  userIds
) {
  const online =
    new Set(
      userIds.map(String)
    );

  document
    .querySelectorAll(
      "[data-online-for]"
    )
    .forEach(
      (element) => {
        const isOnline = online.has(
          String(element.dataset.onlineFor)
        );
        element.classList.toggle(
          "is-online",
          isOnline
        );
      }
    );
}

// ========================================
// AUTH FETCH
// ========================================

async function authFetch(
  url,
  options = {}
) {
  if (!token) {
    throw new Error(
      "No authentication token"
    );
  }

  const headers = {
    ...(options.headers || {}),

    Authorization:
      `Bearer ${token}`,
  };

  return fetch(
    API + url,
    {
      ...options,
      headers,
    }
  );
}

// ========================================
// LOGOUT
// ========================================

if (logoutButton) {
  logoutButton.addEventListener(
    "click",
    logout
  );
}

function logout() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  clearTimeout(
    typingTimer
  );

  localStorage.removeItem(
    "chat_token"
  );

  localStorage.removeItem(
    "chat_user"
  );

  token = null;
  currentUser = null;
  selectedUser = null;

  if (authSection) {
    authSection.classList.remove(
      "hidden"
    );
  }

  if (chatSection) {
    chatSection.classList.add(
      "hidden"
    );
  }

  if (authMessage) {
    authMessage.textContent = "";
  }

  if (loginForm) {
    loginForm.reset();
  }

  if (registerForm) {
    registerForm.reset();
  }

  if (messageContainer) {
    messageContainer.innerHTML = "";
  }

  if (usersList) {
    usersList.innerHTML = "";
  }

  if (clientTotal) {
    clientTotal.textContent =
      "0 online";
  }

  if (socketStatus) {
    socketStatus.textContent =
      "Socket is not connected ❌";

    socketStatus.classList.remove(
      "connected"
    );
  }

  groupUnread = 0;

  Object.keys(
    unreadMessages
  ).forEach(
    (key) => {
      delete unreadMessages[key];
    }
  );

  hideTyping();
}

// ========================================
// ESCAPE HTML
// ========================================

function escapeHtml(
  value
) {
  const div =
    document.createElement(
      "div"
    );

  div.textContent =
    value ?? "";

  return div.innerHTML;
}

// ========================================
// AUTO LOGIN
// ========================================

async function autoLogin() {
  if (!token) {
    return;
  }

  try {
    console.log(
      "🔐 Checking saved JWT..."
    );

    const response =
      await fetch(
        `${API}/me`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

    if (!response.ok) {
      throw new Error(
        "Invalid or expired token"
      );
    }

    const data =
      await response.json();

    if (
      !data.user
    ) {
      throw new Error(
        "Invalid user response"
      );
    }

    currentUser = {
      id:
        data.user.id,

      username:
        data.user.username,

      email:
        data.user.email,
    };

    localStorage.setItem(
      "chat_user",
      JSON.stringify(
        currentUser
      )
    );

    console.log(
      "✅ Auto login successful:",
      currentUser.username
    );

    await startChat();

  } catch (error) {
    console.error(
      "Auto login error:",
      error
    );

    localStorage.removeItem(
      "chat_token"
    );

    localStorage.removeItem(
      "chat_user"
    );

    token = null;
    currentUser = null;

    if (authSection) {
      authSection.classList.remove(
        "hidden"
      );
    }

    if (chatSection) {
      chatSection.classList.add(
        "hidden"
      );
    }

    if (authMessage) {
      authMessage.textContent =
        "Please login again.";
    }
  }
}

// ========================================
// START APPLICATION
// ========================================

autoLogin();

