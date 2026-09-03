const authSection =
  document.getElementById("auth-section");

const chatSection =
  document.getElementById("chat-section");

const showLoginButton =
  document.getElementById("show-login");

const showRegisterButton =
  document.getElementById("show-register");

const loginForm =
  document.getElementById("login-form");

const registerForm =
  document.getElementById("register-form");

const authMessage =
  document.getElementById("auth-message");

const currentUserElement =
  document.getElementById("current-user");

const logoutButton =
  document.getElementById("logout-button");

const groupChatButton =
  document.getElementById("group-chat-button");

const usersList =
  document.getElementById("users-list");

const chatTitle =
  document.getElementById("chat-title");

const clientTotal =
  document.getElementById("client-total");

const messageForm =
  document.getElementById("message-form");

const messageInput =
  document.getElementById("message-input");

const messageContainer =
  document.getElementById("message-container");

const feedback =
  document.getElementById("feedback");

const API = "/api";

const ROOM = "general";

let token =
  localStorage.getItem("chat_token");

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
// LOGIN / REGISTER
// ========================================

showLoginButton.addEventListener(
  "click",
  () => {
    showLoginButton.classList.add(
      "active"
    );

    showRegisterButton.classList.remove(
      "active"
    );

    loginForm.classList.remove(
      "hidden"
    );

    registerForm.classList.add(
      "hidden"
    );

    authMessage.textContent = "";
  }
);

showRegisterButton.addEventListener(
  "click",
  () => {
    showRegisterButton.classList.add(
      "active"
    );

    showLoginButton.classList.remove(
      "active"
    );

    registerForm.classList.remove(
      "hidden"
    );

    loginForm.classList.add(
      "hidden"
    );

    authMessage.textContent = "";
  }
);

// ========================================
// REGISTER
// ========================================

registerForm.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    const body = {
      username:
        document
          .getElementById(
            "register-username"
          )
          .value.trim(),

      email:
        document
          .getElementById(
            "register-email"
          )
          .value.trim(),

      password:
        document
          .getElementById(
            "register-password"
          )
          .value
    };

    await authenticate(
      "/auth/register",
      body
    );
  }
);

// ========================================
// LOGIN
// ========================================

loginForm.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    const body = {
      email:
        document
          .getElementById(
            "login-email"
          )
          .value.trim(),

      password:
        document
          .getElementById(
            "login-password"
          )
          .value
    };

    await authenticate(
      "/auth/login",
      body
    );
  }
);

// ========================================
// AUTHENTICATE
// ========================================

async function authenticate(
  endpoint,
  body
) {
  authMessage.textContent =
    "Please wait...";

  try {
    const response =
      await fetch(
        API + endpoint,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(body)
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      authMessage.textContent =
        data.message ||
        "Authentication failed";

      return;
    }

    token = data.token;

    currentUser = data.user;

    localStorage.setItem(
      "chat_token",
      token
    );

    startChat();
  } catch (error) {
    authMessage.textContent =
      "Cannot connect to server";
  }
}

// ========================================
// START CHAT
// ========================================

async function startChat() {
  authSection.classList.add(
    "hidden"
  );

  chatSection.classList.remove(
    "hidden"
  );

  currentUserElement.textContent =
    `${currentUser.username} (${currentUser.email})`;

  await loadUsers();

  await selectGroupChat();

  connectSocket();
}

// ========================================
// CONNECT SOCKET
// ========================================

function connectSocket() {
  if (socket) {
    socket.disconnect();
  }

  socket = io({
    auth: {
      token
    }
  });

  socket.on(
    "connect",
    () => {
      socket.emit(
        "join-room",
        ROOM
      );
    }
  );

  socket.on(
    "connect_error",
    (error) => {
      if (
        error.message.includes(
          "expired"
        ) ||
        error.message.includes(
          "Invalid"
        )
      ) {
        logout();
      }
    }
  );

  // ========================================
  // CURRENT USER
  // ========================================

  socket.on(
    "current-user",
    (user) => {
      currentUser = user;

      currentUserElement.textContent =
        `${user.username} (${user.email})`;
    }
  );

  // ========================================
  // ONLINE USERS
  // ========================================

  socket.on(
    "online-users",
    (userIds) => {
      clientTotal.textContent =
        `${userIds.length} online`;

      updateOnlineIndicators(
        userIds
      );
    }
  );

  // ========================================
  // GROUP MESSAGE
  // ========================================

  socket.on(
    "message",
    (data) => {
      // Group chat is currently open
      if (
        selectedUser === null &&
        data.room === ROOM
      ) {
        renderMessage(data);

        return;
      }

      // Group chat is NOT open
      if (
        data.room === ROOM
      ) {
        increaseGroupUnread();
      }
    }
  );

  // ========================================
  // PRIVATE MESSAGE
  // ========================================

  socket.on(
    "private-message",
    (data) => {
      const senderId =
        String(data.senderId);

      const myId =
        String(currentUser.id);

      // ====================================
      // MY OWN MESSAGE
      // ====================================

      if (
        senderId === myId
      ) {
        if (
          selectedUser &&
          String(
            selectedUser._id
          ) ===
            String(
              data.receiverId
            )
        ) {
          renderMessage(data);
        }

        return;
      }

      // ====================================
      // RECEIVER IS OPENING THIS CHAT
      // ====================================

      if (
        selectedUser &&
        String(
          selectedUser._id
        ) === senderId
      ) {
        renderMessage(data);

        return;
      }

      // ====================================
      // RECEIVER IS NOT OPENING THIS CHAT
      // ====================================

      increaseUnread(
        senderId
      );
    }
  );

  // ========================================
  // GROUP TYPING
  // ========================================

  socket.on(
    "typing",
    (data) => {
      if (
        selectedUser === null
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

  // ========================================
  // PRIVATE TYPING
  // ========================================

  socket.on(
    "private-typing",
    (data) => {
      if (
        selectedUser &&
        String(
          selectedUser._id
        ) ===
          String(
            data.senderId
          )
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
        String(
          selectedUser._id
        ) ===
          String(
            data.senderId
          )
      ) {
        hideTyping();
      }
    }
  );

  // ========================================
  // CHAT ERROR
  // ========================================

  socket.on(
    "chat-error",
    (data) => {
      feedback.textContent =
        data.message ||
        "Chat error";
    }
  );
}

// ========================================
// LOAD USERS
// ========================================

async function loadUsers() {
  try {
    const response =
      await authFetch(
        "/messages/users"
      );

    if (!response.ok) {
      return;
    }

    const data =
      await response.json();

    usersList.innerHTML = "";

    for (
      const user of data.users
    ) {
      createUserButton(user);
    }
  } catch (error) {
    console.error(error);
  }
}

// ========================================
// CREATE USER BUTTON
// ========================================

function createUserButton(user) {
  const button =
    document.createElement(
      "button"
    );

  button.className =
    "user-button";

  button.dataset.userId =
    user._id;

  button.innerHTML = `
    <div class="user-info">

      <span
        class="online-dot"
        data-online-for="${user._id}"
      >⚪</span>

      <span class="username">
        ${escapeHtml(
          user.username
        )}
      </span>

    </div>

    <span
      class="unread-count hidden"
      data-unread-for="${user._id}"
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

  groupChatButton.classList.add(
    "active"
  );

  document
    .querySelectorAll(
      ".user-button"
    )
    .forEach((button) => {
      button.classList.remove(
        "active"
      );
    });

  chatTitle.textContent =
    "General Group";

  hideTyping();

  messageContainer.innerHTML =
    "";

  try {
    const response =
      await authFetch(
        `/messages/group?room=${encodeURIComponent(
          ROOM
        )}`
      );

    const data =
      await response.json();

    for (
      const message of data.messages
    ) {
      renderMessage({
        id: message._id,

        senderId:
          message.sender,

        senderUsername:
          message.senderUsername,

        message:
          message.message,

        dateTime:
          message.createdAt,

        type: "group"
      });
    }
  } catch (error) {
    console.error(error);
  }
}

// ========================================
// PRIVATE CHAT
// ========================================

async function selectPrivateChat(
  user
) {
  selectedUser = user;

  groupChatButton.classList.remove(
    "active"
  );

  document
    .querySelectorAll(
      ".user-button"
    )
    .forEach((button) => {
      button.classList.toggle(
        "active",

        button.dataset.userId ===
          String(user._id)
      );
    });

  chatTitle.textContent =
    `Private chat with ${user.username}`;

  hideTyping();

  messageContainer.innerHTML =
    "";

  // Clear unread count
  clearUnread(
    user._id
  );

  try {
    const response =
      await authFetch(
        `/messages/private/${user._id}`
      );

    const data =
      await response.json();

    for (
      const message of data.messages
    ) {
      renderMessage({
        id: message._id,

        senderId:
          message.sender,

        senderUsername:
          message.senderUsername,

        receiverId:
          message.receiver,

        receiverUsername:
          message.receiverUsername,

        message:
          message.message,

        dateTime:
          message.createdAt,

        type: "private"
      });
    }
  } catch (error) {
    console.error(error);
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

    const text =
      messageInput.value.trim();

    if (
      !text ||
      !socket?.connected
    ) {
      return;
    }

    // ====================================
    // PRIVATE MESSAGE
    // ====================================

    if (selectedUser) {
      socket.emit(
        "private-message",
        {
          receiverId:
            selectedUser._id,

          message: text
        }
      );

      socket.emit(
        "private-stop-typing",
        {
          receiverId:
            selectedUser._id
        }
      );
    }

    // ====================================
    // GROUP MESSAGE
    // ====================================

    else {
      socket.emit(
        "message",
        {
          room: ROOM,
          message: text
        }
      );

      socket.emit(
        "stop-typing",
        {
          room: ROOM
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
    if (
      !socket?.connected
    ) {
      return;
    }

    clearTimeout(
      typingTimer
    );

    // ====================================
    // PRIVATE TYPING
    // ====================================

    if (selectedUser) {
      socket.emit(
        "private-typing",
        {
          receiverId:
            selectedUser._id
        }
      );

      typingTimer =
        setTimeout(() => {
          socket.emit(
            "private-stop-typing",
            {
              receiverId:
                selectedUser._id
            }
          );
        }, 900);

      return;
    }

    // ====================================
    // GROUP TYPING
    // ====================================

    socket.emit(
      "typing",
      {
        room: ROOM
      }
    );

    typingTimer =
      setTimeout(() => {
        socket.emit(
          "stop-typing",
          {
            room: ROOM
          }
        );
      }, 900);
  }
);

// ========================================
// TYPING UI
// ========================================

function showTyping(
  username
) {
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
  feedback.textContent = "";
}

// ========================================
// PRIVATE UNREAD MESSAGE
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
      groupUnread > 1
        ? "s"
        : ""
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
  const row =
    document.createElement(
      "div"
    );

  const mine =
    String(data.senderId) ===
    String(currentUser.id);

  row.className =
    `message-row ${
      mine ? "mine" : ""
    }`;

  const bubble =
    document.createElement(
      "div"
    );

  bubble.className =
    "bubble";

  const sender =
    document.createElement(
      "div"
    );

  sender.className =
    "sender";

  sender.textContent =
    mine
      ? "You"
      : (
          data.senderUsername ||
          "User"
        );

  const text =
    document.createElement(
      "div"
    );

  text.textContent =
    data.message;

  const time =
    document.createElement(
      "span"
    );

  time.className =
    "time";

  time.textContent =
    formatDate(
      data.dateTime
    );

  bubble.appendChild(
    sender
  );

  bubble.appendChild(
    text
  );

  bubble.appendChild(
    time
  );

  row.appendChild(
    bubble
  );

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
  return new Date(
    value
  ).toLocaleString();
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
  const headers = {
    ...(options.headers || {}),

    Authorization:
      `Bearer ${token}`
  };

  return fetch(
    API + url,
    {
      ...options,
      headers
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
    socket.disconnect();

    socket = null;
  }

  localStorage.removeItem(
    "chat_token"
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

  authMessage.textContent =
    "";

  loginForm.reset();

  registerForm.reset();
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
    value;

  return div.innerHTML;
}

// ========================================
// AUTO LOGIN
// ========================================

if (token) {
  fetch(
    `${API}/me`,
    {
      headers: {
        Authorization:
          `Bearer ${token}`
      }
    }
  )
    .then(
      async (response) => {
        if (!response.ok) {
          throw new Error(
            "Invalid token"
          );
        }

        const data =
          await response.json();

        currentUser =
          data.user;

        startChat();
      }
    )
    .catch(() => {
      localStorage.removeItem(
        "chat_token"
      );

      token = null;
    });
}