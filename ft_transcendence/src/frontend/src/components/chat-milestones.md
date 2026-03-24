# Chat Frontend Integration Milestones

Ordered build plan for connecting the React frontend to the chat-service backend.
The backend contract is stable (M0–M9 complete). Each milestone is independently verifiable.

**Auth assumption:** `accessToken` available via `useAuth()` from `AuthContext`.
**REST base URL:** `window.location.origin + "/api"` — all chat REST goes through nginx → gateway → chat-service.
**WebSocket URL:** `window.location.origin` — namespace `/chat` goes nginx → chat-service directly.

---

## F0 — Setup ✅

**Goal:** Frontend can talk to the backend. No chat logic yet.

- Install `socket.io-client`
- Create `src/api/chat.js` with Authorization header
- Verify `GET /api/chat/conversations` responds

---

## F1 — Conversations ✅

**Goal:** User sees their real conversations.

- Call `GET /api/chat/conversations` on ChatModule mount
- Render conversation list
- On click, set the selected conversation as active

---

## F2 — Message History ✅

**Goal:** Selecting a conversation loads persisted messages.

- Call `GET /api/chat/conversations/:id/messages` when a conversation is selected
- Render messages oldest → newest
- Visually distinguish own messages (YOU) vs others (username)

---

## F3 — WebSocket Connection ✅

**Goal:** Socket connected and authenticated. No messages yet.

- Create `src/hooks/useChat.js`
- Connect to `/chat` namespace with JWT in handshake
- Join room on conversation select via `joinConversation`
- Disconnect on unmount

---

## F4 — Real-time Messaging ✅

**Goal:** Send and receive messages without reloading.

- `handleSendMessage` emits `sendMessage` via WebSocket
- Listen for `newMessage` and append to state
- Listen for `messageFailed`
- Auto-scroll to bottom on new message

---

## F5 — Typing Indicators & Presence ✅

**Goal:** Full real-time UX.

- Emit `typingStart`/`typingStop` with 2s debounce
- Show "Someone is typing..." indicator
- Green/grey presence dot per conversation

---

## M0 — Backend: Search & Join ✅

**Goal:** Backend endpoints to support search and join.

- `GET /users/search?q=` in users-service + proxy in gateway
- `GET /conversations/search?q=` — search public channels
- `POST /conversations/:id/participants` — join a channel
- Fix gateway: `req.path` → `req.url` to preserve query params
- Columns `is_public` and `description` added to `chat.conversations`

---

## M1 — ChatModule: Stack navigation ✅

**Goal:** Replace tab system with view stack.

- Views: `inbox | chat | search | create`
- Inbox as default (no forced Arena on mount)
- Chat view with `←` + conversation name
- Arena_General still find-or-created on first load

---

## M2 — ChatModule: Search view ✅

**Goal:** Search users and channels from the ChatModule.

- Debounced search (300ms), parallel user + channel queries
- Users: username + `[DM]` button
- Channels: name + `[Join]` or `[Open]`

---

## M3 — ChatModule: Create channel ✅

**Goal:** Create a new channel from the ChatModule.

- `+` button opens create view
- Form: name (required), description (optional), public/private toggle
- On submit: creates channel and opens it

---

## Pending

### ChatModule
- **M4** — Badge de mensajes no leídos (contador en conversaciones no activas)
- Revertir fix temporal de layout en `Landing.jsx` (`hidden lg:flex`)
- UI para editar mensajes (backend ya listo)

### `/profile` — módulo obligatorio del subject
- Tab "Friends" — lista, add/remove
- Vista `/profile/:id` — perfil público + botón DM + botón Add friend
- Sistema de amigos en users-service (tabla DB + endpoints list/add/remove)

---

## Backend contract reference

**REST (via `/api/chat/`):**
- `POST /conversations` — create DM or channel (`type`, `name`, `is_public`, `description`, `participantIds`)
- `GET /conversations` — list user's conversations
- `GET /conversations/search?q=` — search public channels
- `POST /conversations/:id/participants` — join a channel
- `GET /conversations/:id/messages?limit=50&before=<ts>&beforeId=<id>` — paginated history
- `POST /conversations/:id/messages` — send message (REST fallback)
- `PATCH /conversations/:id/messages/:messageId` — edit message

**REST (via `/api/`):**
- `GET /users/search?q=` — search users by username

**Socket events (client → server):**
- `joinConversation` — `{ conversationId }`
- `leaveConversation` — `{ conversationId }`
- `sendMessage` — `{ conversationId, content }`
- `typingStart` / `typingStop` — `{ conversationId }`

**Socket events (server → client):**
- `newMessage` — `{ id, conversationId, senderId, content, createdAt, editedAt, sender: { username } }`
- `messageEdited` — same shape as newMessage
- `messageFailed` — `{ conversationId, error }`
- `rateLimitExceeded` — `{ conversationId, retryAfter }`
- `userOnline` / `userOffline` — `{ userId }`
- `typingStart` / `typingStop` — `{ conversationId, userId }`
