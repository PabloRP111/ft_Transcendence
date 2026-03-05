# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack web application built as a microservices system centered around a real-time multiplayer Tron-style 2D light-cycles game. The platform includes gameplay, chat, and user management exposed through a unified web interface.

Each service owns its own domain and data. A PostgreSQL database is the primary store for persistent state. Authentication uses JWTs validated independently by each service (shared signing key, no auth service dependency). Real-time features use Socket.IO. External traffic goes through an API Gateway (HTTP) and Nginx (reverse proxy, edge config).

**Current status:** Early stage. Most services are scaffolds or not yet started. Decisions are still being made. Placeholders are acceptable for cross-service integration points — they will be filled in as the project progresses.

---

## Chat-service

### Objective

A chat microservice responsible for real-time and persistent messaging. It must run independently, plug into the main app with minimal coupling, and have no dependency on game logic or user-service internals.

### Tech Stack

**Backend:**
- Node.js + TypeScript + Express
- Socket.IO (real-time)
- PostgreSQL with raw SQL (no ORM)
- JWT validation via shared secret

**Frontend (chat module):**
- React + Vite + TypeScript
- Zustand (state)
- Socket.IO client

### Architecture

#### 1.1 Responsibilities

The chat-service owns:
- Conversations (private DMs and channels)
- Message persistence
- Real-time socket connections
- Online/offline presence tracking (in-memory; lost on restart is acceptable)
- Access control to conversations

The chat-service must NOT contain game logic, user profile management, or gateway routing logic.

#### 1.2 Socket Location

Socket.IO server lives inside the chat-service (namespace `/chat`). The Gateway does not process chat socket events.

Traffic flow:
```
Frontend → Nginx → chat-service (/chat namespace)
```

JWT tokens are validated at the socket handshake using the shared secret. `userOnline` / `userOffline` events are **server-emitted only**, triggered by socket connect/disconnect lifecycle — not client-driven.

#### 1.3 Persistence Strategy

All messages are persisted to PostgreSQL **before** emitting via socket. No ephemeral-only messages. If a DB write fails, emit a `messageFailed` event to the sender and do not broadcast.

#### 1.4 Inter-service Communication

The chat-service must not make synchronous calls to the users-service for normal operation. It only needs:
- The shared JWT secret (from env)
- `userId` extracted from the token

Any integration point that requires data from another service should be implemented as a placeholder (e.g., a stub function or a TODO comment with the expected interface) until that service is ready.

#### 1.5 REST + Socket Contract

**REST endpoints:**
- `POST /conversations` — create a conversation (DM or channel)
- `GET /conversations` — list conversations for the authenticated user
- `GET /conversations/:id/messages` — fetch message history (paginated)
- `PATCH /conversations/:id/messages/:messageId` — edit a message

**Socket events (client → server):**
- `sendMessage` — send a message to a conversation
- `joinConversation` — join a socket room
- `leaveConversation` — leave a socket room
- `typingStart` / `typingStop` — ephemeral, not persisted

**Socket events (server → client):**
- `newMessage` — new message broadcast to room
- `messageEdited` — edit broadcast to room
- `messageFailed` — sent only to the originating client on failure
- `userOnline` / `userOffline` — presence events, server-driven
- `typingStart` / `typingStop` — rebroadcast to room, excluding sender

Do not modify event names or payload contracts without explicit instruction.

#### 1.6 Offline Messaging

Supported by default via the persistence strategy: messages are always written to DB. When a user reconnects, they fetch missed messages via `GET /conversations/:id/messages`. No special delivery logic required.

### Data Model

**Database:** PostgreSQL — one dedicated DB (e.g., `chat_db`). UUIDs generated via `gen_random_uuid()` (pgcrypto).

**conversations**
| field | type |
|---|---|
| id | UUID PK |
| type | `private` \| `channel` |
| name | TEXT nullable |
| created_at | TIMESTAMPTZ |

**conversation_participants**
| field | type |
|---|---|
| conversation_id | UUID FK |
| user_id | UUID |
| role | `member` \| `admin` |
| joined_at | TIMESTAMPTZ |

**messages**
| field | type |
|---|---|
| id | UUID PK |
| conversation_id | UUID FK |
| sender_id | UUID |
| content | TEXT |
| created_at | TIMESTAMPTZ |
| edited_at | TIMESTAMPTZ nullable |

Indexes: `messages(conversation_id)`, `messages(conversation_id, created_at)`.

### Independence Requirement

The service must run with only two env vars: `DATABASE_URL` and `JWT_SECRET`. An `.env.example` must be kept up to date. Integration into the main app requires only changing base URLs and using the same JWT secret.

---

## Claude Usage Guidelines

**Scope:** EXCLUSIVELY the chat-service. Do not modify or suggest changes to other services, the gateway, nginx config, or the main frontend unless the file is under `/chat-service/frontend/`.

**Always:**
- Use raw SQL with parameterized queries (never string interpolation)
- Validate conversation participation before every read/write
- Persist to DB before emitting any socket event
- Use TypeScript strict mode; prefer `unknown` with explicit narrowing over `any`
- Comment multi-join SQL queries and non-obvious socket sequencing

**Never:**
- Add game logic or user profile management
- Make synchronous calls to other services (use a placeholder/stub if cross-service data is needed)
- Add infrastructure dependencies (Redis, queues, brokers) — keep it simple
- Modify event names or payload shapes unless explicitly instructed

**On new cross-service integration points:** implement a clearly marked placeholder (stub function + TODO comment describing the expected interface) rather than blocking on the other service being ready.

### Development Workflow

```bash
npm run dev        # Express + Socket.IO + DB migrations on startup
npm run lint -- --fix
npm test -- --watch
curl ...           # test REST endpoints
websocat ...       # test socket events
docker-compose up chat-db-only   # DB only for integration tests
```

Migrations run automatically on startup. They must be idempotent (`IF NOT EXISTS`).


## Learning Guidance

To help the user understand the code and architecture while developing the chat-service, follow these guidelines:

### 1. Add explanatory comments
- Whenever generating or modifying files inside `src/` (or other key project files), add **inline comments** explaining what each section or function does.
- Highlight purpose, flow, and key technical concepts (Express routes, middleware, async DB calls, Socket.IO events, etc.).

### 2. Explain before creating new files

Before creating any new config, source, or folder file, provide a brief explanation:

- Why this file is needed
- What it will contain
- How it interacts with the rest of the project
- Any critical decisions the user should know

### 3. Emphasize beginner-friendly explanations

Use plain language and step-by-step reasoning for technical content.
Avoid assuming prior knowledge of TypeScript, Node.js, Express, Socket.IO, Docker, or PostgreSQL.