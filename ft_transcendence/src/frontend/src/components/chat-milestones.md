# Chat Frontend Integration Milestones

Ordered build plan for connecting the React frontend to the chat-service backend.
The backend contract is stable (M0–M9 complete). Each milestone is independently verifiable.

**Auth assumption:** `accessToken` available via `useAuth()` from `AuthContext`.
**REST base URL:** `window.location.origin + "/api"` — all chat REST goes through nginx → gateway → chat-service.
**WebSocket URL:** `window.location.origin` — namespace `/chat` goes nginx → chat-service directly.

---

## F0 — Setup

**Goal:** Frontend can talk to the backend. No chat logic yet.

- Install `socket.io-client`:
  ```bash
  npm install socket.io-client
  ```
- Create `src/api/chat.js` with a base fetch helper that includes:
  ```js
  headers: { Authorization: `Bearer ${accessToken}` }
  ```
- Verify `GET /api/chat/conversations` responds (empty array is fine)

**Verification:** `fetch("/api/chat/conversations")` from the browser returns 200.

---

## F1 — Conversations

**Goal:** User sees their real conversations.

- Call `GET /api/chat/conversations` on ChatModule mount
- Render conversation list instead of MOCK_FRIENDS
- On click, set the selected conversation as active
- State needed: `conversations`, `activeConversationId`

**Verification:** Create a conversation via REST and confirm it appears in the list.

---

## F2 — Message History

**Goal:** Selecting a conversation loads persisted messages.

- Call `GET /api/chat/conversations/:id/messages` when a conversation is selected
- Render messages oldest → newest
- Visually distinguish own messages vs others using `userId` from `AuthContext`

**Verification:** Send a message via REST and confirm it appears when selecting the conversation.

---

## F3 — WebSocket Connection

**Goal:** Socket connected and authenticated. No messages yet.

- Create `src/hooks/useChat.js`:
  ```js
  const socket = io("/chat", { auth: { token: accessToken } })
  ```
- Join the room on conversation select: emit `joinConversation`
- Handle connection errors (expired token, server down)
- Disconnect on component unmount

**Verification:** Chat-service logs show `user X connected` when the component mounts.

---

## F4 — Real-time Messaging

**Goal:** Send and receive messages without reloading.

- `handleSendMessage` emits `sendMessage` via WebSocket instead of modifying local state
- Listen for `newMessage` and append to state
- Listen for `messageFailed` and show error to the user
- Auto-scroll to bottom on new message

**Verification:** Two browser tabs open — message sent from one appears in the other instantly.

---

## F5 — Typing Indicators & Presence

**Goal:** Full real-time UX.

- Emit `typingStart` while typing, `typingStop` when stopped (use debounce ~1s)
- Show "X is typing..." when receiving `typingStart`
- Show green/grey dot per user based on `userOnline` / `userOffline` events

**Verification:** Type in one tab, see the indicator appear in the other.

---

## F6 — Create Conversation

**Goal:** User can start a DM from the UI.

- Call `POST /api/chat/conversations` with `{ type: "private", participantIds: [targetUserId] }`
- Add a button or form to start a DM with another user
- New conversation appears in the list and is selected automatically

**Verification:** Create a DM between two users and exchange messages end-to-end.

---

## Summary

| # | What | REST | WebSocket |
|---|------|------|-----------|
| F0 | Setup | base client | install lib |
| F1 | Conversations | GET /conversations | — |
| F2 | Message history | GET /messages | — |
| F3 | WS connection | — | connect/auth |
| F4 | Real-time messaging | — | send/receive |
| F5 | Typing + presence | — | typing/online |
| F6 | Create conversation | POST /conversations | — |

---

## Backend contract reference

**REST endpoints (via `/api/chat/`):**
- `POST /conversations` — create DM or channel
- `GET /conversations` — list user's conversations
- `GET /conversations/:id/messages?limit=50&before=<ts>&beforeId=<id>` — paginated history
- `POST /conversations/:id/messages` — send message
- `PATCH /conversations/:id/messages/:messageId` — edit message

**Socket events (client → server):**
- `joinConversation` — `{ conversationId }`
- `leaveConversation` — `{ conversationId }`
- `sendMessage` — `{ conversationId, content }`
- `typingStart` — `{ conversationId }`
- `typingStop` — `{ conversationId }`

**Socket events (server → client):**
- `newMessage` — `{ id, conversationId, senderId, content, createdAt, editedAt }`
- `messageEdited` — same shape as newMessage
- `messageFailed` — `{ conversationId, error }`
- `rateLimitExceeded` — `{ conversationId, retryAfter }`
- `userOnline` — `{ userId }`
- `userOffline` — `{ userId }`
- `typingStart` — `{ conversationId, userId }`
- `typingStop` — `{ conversationId, userId }`
