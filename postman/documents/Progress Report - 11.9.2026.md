# Progress Report — September 11, 2026

## 🗓️ Date
September 11, 2026

## 🌅 Morning Session

### ✅ What I Worked On
- **CRUD with React** — Practiced building Create, Read, Update, and Delete operations using React
- **Frontend Practice** — Worked on frontend development skills and UI implementation

## 🌆 Afternoon Session

### ✅ What Was Done
- **Created Postman Collection** — Built a complete Chat API collection with 7 requests:
  - `POST /api/auth/register` — User registration with auto-save token script
  - `POST /api/auth/login` — User login with auto-save JWT token to environment
  - `GET /api/me` — Get current authenticated user
  - `GET /api/health` — Server health check
  - `GET /api/messages/users` — Get all users list
  - `GET /api/messages/group` — Get group chat messages
  - `GET /api/messages/private/:userId` — Get private messages
- **Created Postman Environment** — Set up `Chat API` environment with:
  - `baseUrl` → `http://localhost:4000`
  - `token` → auto-populated on login/register
  - `userId` → auto-populated on login/register
- **Added Test Scripts** — Every request has automated tests for status codes, response structure, and data validation
- **Auto Token Management** — Login and Register requests automatically save JWT token and userId to environment variables

## 📌 Project Context
Working on: **Chat App** (Node.js, Express, Socket.io, MongoDB, JWT Auth)

---

*Last updated: September 11, 2026*
