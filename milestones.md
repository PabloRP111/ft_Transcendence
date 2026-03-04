# Chat-service Milestones

Ordered build plan. The service must be runnable at every step. Minimize schema and contract changes in later milestones by getting foundations right early.

---

## M0 — Project Scaffold

**Goal:** Runnable service with a health endpoint. No business logic.

- TypeScript + Express project (`tsconfig.json` with strict mode)
- `GET /health` → `{ status: "ok" }`
- `.env.example` with `PORT`, `DATABASE_URL`, `JWT_SECRET`
- `docker-compose.yml` with `chat-service`, `chat-db` (postgres), and a `chat-db-only` profile
- Scripts: `npm run dev`, `npm run build`, `npm run lint`, `npm test`

**Tests:** `curl /health` returns 200. Service starts and stops cleanly.

---

## M1 — Database & Migrations

**Goal:** Full schema in place, applied automatically on startup.

- Raw SQL migration runner — reads numbered `.sql` files from `migrations/`
- Enable pgcrypto extension (`gen_random_uuid()`)
- Create tables: `conversations`, `conversation_participants`, `messages` (exact schema from CLAUDE.md)
- Indexes: `messages(conversation_id)`, `messages(conversation_id, created_at)`
- Migrations run before the server begins accepting requests; crash fast if DB is unreachable

**Tests:** Run migrations twice — second run must be idempotent. Inspect schema with `psql` or `\d` queries.

---

## M2 — JWT Middleware

**Goal:** Auth boundary established before any endpoint logic exists.

- `src/middleware/auth.ts` — validates Bearer token, attaches `req.userId: string`
- Returns `401` for: missing token, invalid signature, expired token
- Reads `JWT_SECRET` from env only — no call to users-service
- Applied globally to all routes except `/health`

**Tests:** Unit tests (no DB needed) — valid token, expired token, missing token, tampered signature.

---

## M3 — REST: Conversations

**Goal:** Create and list conversations. Access control enforced.

- `POST /conversations` — creates DM or channel; inserts creator as `admin` participant
- `GET /conversations` — returns only conversations the requester participates in
- Participant check enforced on every query

**Tests:** Integration tests against test DB (roll back per test):
- Create DM → listed for creator, not visible to non-participant
- Create channel → same

---

## M4 — REST: Messages

**Goal:** Persist and retrieve messages. Offline delivery path is complete after this milestone.

- `POST /conversations/:id/messages` — validate participant, insert, return saved message object
- `GET /conversations/:id/messages` — cursor-based pagination (`created_at` + `id`), default page size 50
- Response shape: `{ id, conversationId, senderId, content, createdAt, editedAt }`

**Tests:**
- Send as non-participant → 403
- Paginate across page boundary
- Empty conversation returns empty array
- Offline flow: send via REST, confirm message in DB (no socket required)

---

## M5 — Socket.IO: Connection & Auth

**Goal:** Authenticated socket connections. Presence tracking starts here.

- Attach Socket.IO to the same HTTP server, namespace `/chat`
- Handshake middleware: validate JWT from `auth.token`; disconnect immediately on failure
- On connect: register `socket.userId`, update in-memory presence map, emit `userOnline` to relevant rooms
- On disconnect: remove from presence map, emit `userOffline`
- `userOnline` / `userOffline` are server-emitted only (not accepted from clients)

**Tests:** Connect with valid token → accepted. Connect with invalid/missing token → disconnected. Manual verification with `websocat`.

---

## M6 — Socket.IO: Messaging

**Goal:** Real-time send and receive. Persist-before-emit enforced.

- `joinConversation` — validate participant, add socket to room
- `leaveConversation` — remove socket from room
- `sendMessage` — persist to DB first; on success emit `newMessage` to room; on DB failure emit `messageFailed` to sender only (no broadcast)
- `newMessage` payload matches the REST message object shape exactly

**Tests:**
- Two clients in the same conversation: A sends → B receives, A receives own `newMessage`
- Non-participant attempts `joinConversation` → rejected
- Simulated DB failure → `messageFailed` emitted, no broadcast

---

## M7 — Socket.IO: Typing Indicators

**Goal:** Ephemeral typing events. No persistence.

- `typingStart` / `typingStop` — rebroadcast to conversation room, excluding the sender
- Payload: `{ conversationId, userId }`
- No DB write

**Tests:** A emits `typingStart` → B receives it → A does not receive it.

---

## M8 — Message Editing

**Goal:** Edit flow complete across REST and Socket.

- `PATCH /conversations/:id/messages/:messageId` — validate sender owns message; update `content` and `edited_at`
- After successful DB write, emit `messageEdited` to conversation room
- Returns `403` if requester is not the sender

**Tests:**
- Edit as non-owner → 403
- Edit as owner → 200, `edited_at` set, `messageEdited` socket event received by room members

---

## M9 — Rate Limiting & Input Validation

**Goal:** Safe socket layer. No new infrastructure.

- Per-user per-conversation rate limit on `sendMessage` (e.g. 10 messages / 10s, in-memory token bucket)
- On limit breach: emit `rateLimitExceeded` to sender, drop the message
- Validate all REST request bodies and socket payloads: reject oversized content, missing required fields

**Tests:** Burst 20 messages rapidly → first 10 accepted, rest rejected with `rateLimitExceeded`. Invalid payload shapes → rejected with clear error.

---

## M10 — Standalone Verification

**Goal:** Confirm the independence requirement is fully met.

- Service runs with only `DATABASE_URL` and `JWT_SECRET` in env — no other services running
- All REST endpoints return correct responses
- All socket flows work end-to-end
- `.env.example` is accurate and complete
- Zero imports from game-service or user-service code

**Tests:** Full test suite passing with only `chat-db` running in Docker.

---

## Summary

| # | Focus | REST | Socket | DB | Key invariant |
|---|---|---|---|---|---|
| M0 | Scaffold | health | — | — | service starts |
| M1 | Schema | — | — | migrations | idempotent migrations |
| M2 | Auth | middleware | middleware | — | 401 on bad token |
| M3 | Conversations | CRUD | — | read/write | participant isolation |
| M4 | Messages | CRUD + pagination | — | read/write | offline delivery works |
| M5 | Socket auth | — | connect/disconnect | — | presence is server-driven |
| M6 | Real-time send | — | send/receive | write | persist before emit |
| M7 | Typing | — | ephemeral | — | no persistence |
| M8 | Editing | PATCH | messageEdited | write | ownership check |
| M9 | Hardening | validation | rate limit | — | no silent failures |
| M10 | Verification | full | full | full | zero cross-service deps |
