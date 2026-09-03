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
          .value
          .trim(),

      email:
        document
          .getElementById(
            "register-email"
          )
          .value
          .trim(),

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
          .value
          .trim(),

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

    currentUser = {
      id: data.user.id,
      username:
        data.user.username,
      email:
        data.user.email
    };

    localStorage.setItem(
      "chat_token",
      token
    );

    localStorage.setItem(
      "chat_user",
      JSON.stringify(
        currentUser
      )
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
      token: token
    }
  });

  // ======================================
  // CONNECT
  // ======================================

  socket.on(
    "connect",
    () => {
      console.log(
        "Socket connected:",
        socket.id
      );

      socket.emit(
        "join-room",
        ROOM
      );
    }
  );

  // ======================================
  // CONNECT ERROR
  // ======================================

  socket.on(
    "connect_error",
    (error) => {
      console.error(
        "Socket connection error:",
        error.message
      );

      if (
        error.message.includes(
          "expired"
        ) ||
        error.message.includes(
          "Invalid"
        ) ||
        error.message.includes(
          "Authentication"
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
      currentUser = {
        id: user.id,
        username:
          user.username,
        email:
          user.email
      };

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
      if (
        selectedUser === null &&
        data.room === ROOM
      ) {
        renderMessage(data);

        return;
      }

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
            selectedUser.id
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
      // OPEN PRIVATE CHAT
      // ====================================

      if (
        selectedUser &&
        String(
          selectedUser.id
        ) === senderId
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
          selectedUser.id
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
          selectedUser.id
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
      const user of data.users || []
    ) {
      // Do not show current user
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

function createUserButton(
  user
) {
  const button =
    document.createElement(
      "button"
    );

  button.className =
    "user-button";

  button.dataset.userId =
    String(user.id);

  button.innerHTML = `
    <div class="user-info">

      <span
        class="online-dot"
        data-online-for="${user.id}"
      >⚪</span>

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

  groupChatButton.classList.add(
    "active"
  );

  document
    .querySelectorAll(
      ".user-button"
    )
    .forEach(
      (button) => {
        button.classList.remove(
          "active"
        );
      }
    );

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

        type:
          "group"
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

  groupChatButton.classList.remove(
    "active"
  );

  document
    .querySelectorAll(
      ".user-button"
    )
    .forEach(
      (button) => {
        button.classList.toggle(
          "active",
          button.dataset.userId ===
            String(user.id)
        );
      }
    );

  chatTitle.textContent =
    `Private chat with ${user.username}`;

  hideTyping();

  messageContainer.innerHTML =
    "";

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

        type:
          "private"
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
            selectedUser.id,

          message:
            text
        }
      );

      socket.emit(
        "private-stop-typing",
        {
          receiverId:
            selectedUser.id
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
          room:
            ROOM,

          message:
            text
        }
      );

      socket.emit(
        "stop-typing",
        {
          room:
            ROOM
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
            selectedUser.id
        }
      );

      typingTimer =
        setTimeout(
          () => {
            socket.emit(
              "private-stop-typing",
              {
                receiverId:
                  selectedUser.id
              }
            );
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
        room:
          ROOM
      }
    );

    typingTimer =
      setTimeout(
        () => {
          socket.emit(
            "stop-typing",
            {
              room:
                ROOM
            }
          );
        },
        900
      );
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
  feedback.textContent =
    "";
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

  unreadMessages[id] =
    0;

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
    element.textContent =
      "";

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
      count > 1
        ? "s"
        : ""
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
    element.textContent =
      "";

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
  groupUnread =
    0;

  updateGroupUnreadUI();
}

// ========================================
// RENDER MESSAGE
// ========================================

function renderMessage(
  data
) {
  if (
    !currentUser
  ) {
    return;
  }

  const row =
    document.createElement(
      "div"
    );

  const mine =
    String(data.senderId) ===
    String(currentUser.id);

  row.className =
    `message-row ${
      mine
        ? "mine"
        : ""
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
  if (!value) {
    return "";
  }

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
      userIds.map(
        String
      )
    );

  document
    .querySelectorAll(
      "[data-online-for]"
    )
    .forEach(
      (element) => {
        element.textContent =
          online.has(
            String(
              element.dataset
                .onlineFor
            )
          )
            ? "🟢"
            : "⚪";
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

  authMessage.textContent =
    "";

  loginForm.reset();

  registerForm.reset();

  messageContainer.innerHTML =
    "";

  usersList.innerHTML =
    "";
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

        currentUser = {
          id:
            data.user.id,

          username:
            data.user.username,

          email:
            data.user.email
        };

        await startChat();
      }
    )
    .catch(
      (error) => {
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
      }
    );
}