// ========================================
// DOM ELEMENTS
// ========================================

const authSection = document.getElementById("auth-section");
const chatSection = document.getElementById("chat-section");

const showLoginButton = document.getElementById("show-login");
const showRegisterButton = document.getElementById("show-register");

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

const authMessage = document.getElementById("auth-message");

const currentUserElement = document.getElementById("current-user");
const logoutButton = document.getElementById("logout-button");

const groupChatButton = document.getElementById("group-chat-button");
const usersList = document.getElementById("users-list");

const chatTitle = document.getElementById("chat-title");
const clientTotal = document.getElementById("client-total");

const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const messageContainer = document.getElementById("message-container");

const feedback = document.getElementById("feedback");

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
// LOGIN / REGISTER TABS
// ========================================

showLoginButton.addEventListener("click", () => {
  showLoginButton.classList.add("active");
  showRegisterButton.classList.remove("active");

  loginForm.classList.remove("hidden");
  registerForm.classList.add("hidden");

  authMessage.textContent = "";
});

showRegisterButton.addEventListener("click", () => {
  showRegisterButton.classList.add("active");
  showLoginButton.classList.remove("active");

  registerForm.classList.remove("hidden");
  loginForm.classList.add("hidden");

  authMessage.textContent = "";
});

// ========================================
// REGISTER
// ========================================

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const body = {
    username: document
      .getElementById("register-username")
      .value
      .trim(),

    email: document
      .getElementById("register-email")
      .value
      .trim(),

    password: document
      .getElementById("register-password")
      .value,
  };

  await authenticate("/auth/register", body);
});

// ========================================
// LOGIN
// ========================================

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const body = {
    email: document
      .getElementById("login-email")
      .value
      .trim(),

    password: document
      .getElementById("login-password")
      .value,
  };

  await authenticate("/auth/login", body);
});

// ========================================
// AUTHENTICATE
// ========================================

async function authenticate(endpoint, body) {
  authMessage.textContent = "Please wait...";

  try {
    const response = await fetch(API + endpoint, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      authMessage.textContent =
        data.message || "Authentication failed";

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

    localStorage.setItem("chat_token", token);

    localStorage.setItem(
      "chat_user",
      JSON.stringify(currentUser)
    );

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

  authSection.classList.add("hidden");
  chatSection.classList.remove("hidden");

  currentUserElement.textContent =
    `${currentUser.username} (${currentUser.email})`;

  // IMPORTANT:
  // Connect Socket.IO immediately.
  connectSocket();

  // Load users and messages
  await loadUsers();
  await selectGroupChat();
}

// ========================================
// CONNECT SOCKET.IO
// ========================================

function connectSocket() {
  // Disconnect old socket
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

  // Connect explicitly to the same server
  socket = io(SOCKET_URL, {
    auth: {
      token: token,
    },

    transports: ["polling", "websocket"],

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

    feedback.textContent = "";

    // Join general room
    socket.emit("join-room", ROOM);

    console.log("Joined room:", ROOM);
  });

  // ======================================
  // CONNECTION ERROR
  // ======================================

  socket.on("connect_error", (error) => {
    console.error("================================");
    console.error("❌ Socket.IO connection error");
    console.error("Message:", error.message);
    console.error("Error:", error);
    console.error("================================");

    feedback.textContent =
      `Socket error: ${error.message}`;

    if (
      error.message.includes("Invalid") ||
      error.message.includes("expired") ||
      error.message.includes("Authentication") ||
      error.message.includes("required")
    ) {
      console.error(
        "JWT authentication failed."
      );
    }
  });

  // ======================================
  // DISCONNECTED
  // ======================================

  socket.on("disconnect", (reason) => {
    console.log(
      "❌ Socket disconnected:",
      reason
    );

    clientTotal.textContent = "0 online";

    if (reason !== "io client disconnect") {
      feedback.textContent =
        "Socket disconnected ❌ Reconnecting...";
    }
  });

  // ======================================
  // RECONNECTING
  // ======================================

  socket.io.on("reconnect_attempt", (attempt) => {
    console.log(
      `🔄 Socket reconnect attempt: ${attempt}`
    );
  });

  socket.io.on("reconnect", (attempt) => {
    console.log(
      `✅ Socket reconnected after ${attempt} attempt(s)`
    );
  });

  // ======================================
  // CURRENT USER
  // ======================================

  socket.on("current-user", (user) => {
    console.log("Current user:", user);

    currentUser = {
      id: user.id,
      username: user.username,
      email: user.email,
    };

    localStorage.setItem(
      "chat_user",
      JSON.stringify(currentUser)
    );

    currentUserElement.textContent =
      `${user.username} (${user.email})`;
  });

  // ======================================
  // ONLINE USERS
  // ======================================

  socket.on("online-users", (userIds) => {
    console.log(
      "Online users:",
      userIds
    );

    clientTotal.textContent =
      `${userIds.length} online`;

    updateOnlineIndicators(userIds);
  });

  // ======================================
  // GROUP MESSAGE
  // ======================================

  socket.on("message", (data) => {
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
  });

  // ======================================
  // PRIVATE MESSAGE
  // ======================================

  socket.on("private-message", (data) => {
    console.log(
      "📨 Private message received:",
      data
    );

    const senderId = String(data.senderId);
    const myId = String(currentUser.id);

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
      String(selectedUser.id) === senderId
    ) {
      renderMessage(data);
      return;
    }

    // ====================================
    // PRIVATE CHAT NOT OPEN
    // ====================================

    increaseUnread(senderId);
  });

  // ======================================
  // GROUP TYPING
  // ======================================

  socket.on("typing", (data) => {
    if (selectedUser === null) {
      showTyping(data.username);
    }
  });

  socket.on("stop-typing", () => {
    if (selectedUser === null) {
      hideTyping();
    }
  });

  // ======================================
  // PRIVATE TYPING
  // ======================================

  socket.on("private-typing", (data) => {
    if (
      selectedUser &&
      String(selectedUser.id) ===
        String(data.senderId)
    ) {
      showTyping(data.username);
    }
  });

  socket.on("private-stop-typing", (data) => {
    if (
      selectedUser &&
      String(selectedUser.id) ===
        String(data.senderId)
    ) {
      hideTyping();
    }
  });

  // ======================================
  // CHAT ERROR
  // ======================================

  socket.on("chat-error", (data) => {
    console.error(
      "❌ Chat error:",
      data
    );

    feedback.textContent =
      data.message || "Chat error";
  });
}

// ========================================
// LOAD USERS
// ========================================

async function loadUsers() {
  try {
    const response = await authFetch(
      "/messages/users"
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Load users error:",
        data.message
      );

      return;
    }

    usersList.innerHTML = "";

    for (const user of data.users || []) {
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
  const button =
    document.createElement("button");

  button.className = "user-button";

  button.dataset.userId =
    String(user.id);

  button.innerHTML = `
    <div class="user-info">

      <span
        class="online-dot"
        data-online-for="${user.id}"
      >⚪</span>

      <span class="username">
        ${escapeHtml(user.username)}
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

  usersList.appendChild(button);
}

// ========================================
// GROUP CHAT
// ========================================

async function selectGroupChat() {
  selectedUser = null;

  clearGroupUnread();

  groupChatButton.classList.add("active");

  document
    .querySelectorAll(".user-button")
    .forEach((button) => {
      button.classList.remove("active");
    });

  chatTitle.textContent =
    "General Group";

  hideTyping();

  messageContainer.innerHTML = "";

  try {
    const response = await authFetch(
      `/messages/group?room=${encodeURIComponent(
        ROOM
      )}`
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Group messages error:",
        data.message
      );

      return;
    }

    for (const message of data.messages || []) {
      renderMessage({
        id: message.id,
        senderId: message.senderId,
        senderUsername:
          message.senderUsername,
        message: message.message,
        room: message.room,
        dateTime: message.dateTime,
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

async function selectPrivateChat(user) {
  selectedUser = user;

  groupChatButton.classList.remove(
    "active"
  );

  document
    .querySelectorAll(".user-button")
    .forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.userId ===
          String(user.id)
      );
    });

  chatTitle.textContent =
    `Private chat with ${user.username}`;

  hideTyping();

  messageContainer.innerHTML = "";

  clearUnread(user.id);

  try {
    const response = await authFetch(
      `/messages/private/${user.id}`
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Private messages error:",
        data.message
      );

      return;
    }

    for (const message of data.messages || []) {
      renderMessage({
        id: message.id,
        senderId: message.senderId,
        senderUsername:
          message.senderUsername,
        receiverId:
          message.receiverId,
        receiverUsername:
          message.receiverUsername,
        message: message.message,
        dateTime: message.dateTime,
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

groupChatButton.addEventListener(
  "click",
  selectGroupChat
);

// ========================================
// SEND MESSAGE
// ========================================

messageForm.addEventListener(
  "submit",
  (event) => {
    event.preventDefault();

    console.log("================================");
    console.log("🖱️ SEND BUTTON CLICKED");

    const text =
      messageInput.value.trim();

    console.log("Message:", text);
    console.log("Socket:", socket);
    console.log(
      "Socket connected:",
      socket?.connected
    );
    console.log(
      "Selected user:",
      selectedUser
    );
    console.log("================================");

    // Empty message
    if (!text) {
      return;
    }

    // Socket not connected
    if (!socket || !socket.connected) {
      console.error(
        "❌ Socket is NOT connected"
      );

      feedback.textContent =
        "Socket is not connected ❌";

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

    messageInput.value = "";

    hideTyping();
  }
);

// ========================================
// TYPING
// ========================================

messageInput.addEventListener(
  "input",
  () => {
    if (!socket || !socket.connected) {
      return;
    }

    clearTimeout(typingTimer);

    // ====================================
    // PRIVATE TYPING
    // ====================================

    if (selectedUser) {
      socket.emit(
        "private-typing",
        {
          receiverId:
            selectedUser.id,
        }
      );

      typingTimer = setTimeout(
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

    // ====================================
    // GROUP TYPING
    // ====================================

    socket.emit(
      "typing",
      {
        room: ROOM,
      }
    );

    typingTimer = setTimeout(
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

// ========================================
// TYPING UI
// ========================================

function showTyping(username) {
  feedback.innerHTML = `
    <span class="typing-text">
      ${escapeHtml(username)}
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
  feedback.textContent = "";
}

// ========================================
// PRIVATE UNREAD
// ========================================

function increaseUnread(userId) {
  const id = String(userId);

  unreadMessages[id] =
    (unreadMessages[id] || 0) + 1;

  updateUnreadUI(id);
}

function clearUnread(userId) {
  const id = String(userId);

  unreadMessages[id] = 0;

  updateUnreadUI(id);
}

function updateUnreadUI(userId) {
  const id = String(userId);

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
    element.classList.add("hidden");

    return;
  }

  element.classList.remove("hidden");

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
  let element =
    document.getElementById(
      "group-unread"
    );

  if (!element) {
    element =
      document.createElement("span");

    element.id = "group-unread";

    groupChatButton.appendChild(
      element
    );
  }

  if (groupUnread <= 0) {
    element.textContent = "";

    element.classList.add("hidden");

    return;
  }

  element.classList.remove("hidden");

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

function renderMessage(data) {
  if (!currentUser) {
    return;
  }

  const row =
    document.createElement("div");

  const mine =
    String(data.senderId) ===
    String(currentUser.id);

  row.className =
    `message-row ${
      mine ? "mine" : ""
    }`;

  const bubble =
    document.createElement("div");

  bubble.className = "bubble";

  const sender =
    document.createElement("div");

  sender.className = "sender";

  sender.textContent =
    mine
      ? "You"
      : data.senderUsername || "User";

  const text =
    document.createElement("div");

  text.textContent =
    data.message;

  const time =
    document.createElement("span");

  time.className = "time";

  time.textContent =
    formatDate(
      data.dateTime
    );

  bubble.appendChild(sender);
  bubble.appendChild(text);
  bubble.appendChild(time);

  row.appendChild(bubble);

  messageContainer.appendChild(row);

  messageContainer.scrollTop =
    messageContainer.scrollHeight;
}

// ========================================
// DATE
// ========================================

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString();
}

// ========================================
// ONLINE INDICATORS
// ========================================

function updateOnlineIndicators(userIds) {
  const online =
    new Set(
      userIds.map(String)
    );

  document
    .querySelectorAll(
      "[data-online-for]"
    )
    .forEach((element) => {
      element.textContent =
        online.has(
          String(
            element.dataset.onlineFor
          )
        )
          ? "🟢"
          : "⚪";
    });
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

logoutButton.addEventListener(
  "click",
  logout
);

function logout() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  clearTimeout(typingTimer);

  localStorage.removeItem(
    "chat_token"
  );

  localStorage.removeItem(
    "chat_user"
  );

  token = null;
  currentUser = null;
  selectedUser = null;

  authSection.classList.remove(
    "hidden"
  );

  chatSection.classList.add(
    "hidden"
  );

  authMessage.textContent = "";

  loginForm.reset();
  registerForm.reset();

  messageContainer.innerHTML = "";
  usersList.innerHTML = "";

  clientTotal.textContent =
    "0 online";

  groupUnread = 0;

  Object.keys(
    unreadMessages
  ).forEach((key) => {
    delete unreadMessages[key];
  });

  hideTyping();
}

// ========================================
// ESCAPE HTML
// ========================================

function escapeHtml(value) {
  const div =
    document.createElement("div");

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

    currentUser = {
      id: data.user.id,
      username:
        data.user.username,
      email:
        data.user.email,
    };

    localStorage.setItem(
      "chat_user",
      JSON.stringify(currentUser)
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

    authSection.classList.remove(
      "hidden"
    );

    chatSection.classList.add(
      "hidden"
    );

    authMessage.textContent =
      "Please login again.";
  }
}

// ========================================
// START APPLICATION
// ========================================

autoLogin();