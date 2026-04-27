*This project has been created as part of the 42 curriculum by prosas-p, mzuloaga, femoreno, jotrujil, aamoros-.*

# ft_transcendence

## Description

### Project Name
ft_transcendence

### Goal
ft_transcendence is a web multiplayer project where users can register, manage profiles, chat in real time, and play a competitive Tron-style game in both AI and online PvP modes.

### Brief Overview
The project follows a microservices architecture with a central gateway and a reverse proxy. It combines authentication, social interactions, chat, and game logic in a single platform:

- Authentication with access and refresh tokens.
- Profile management with avatar upload.
- Friends and blocking system.
- Real-time chat with private conversations and channels.
- AI game mode and online PvP matchmaking.
- Ranking/score tracking.

### Key Features

- Secure login/register flow (JWT + httpOnly refresh cookie).
- Protected routes and role-safe API access.
- Real-time communication over Socket.IO.
- PostgreSQL persistence for users, sessions, chat, and social data.
- Dockerized environment for reproducible setup.

## Instructions

### Prerequisites

- Docker Engine installed and running.
- Docker Compose available (docker compose plugin or docker-compose binary).
- GNU Make.
- A local HTTPS-compatible browser (project runs behind Nginx on TLS).

### Environment Setup

1. Create a .env file at src/.env.
2. Copy values from src/.env.example.
3. Fill all required variables:

```env
JWT_SECRET=...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...

POSTGRES_USER=...
POSTGRES_PASSWORD=...
POSTGRES_DB=...

SEED_PASSWORD_FEMORENO=...
SEED_PASSWORD_PROSAS=...
SEED_PASSWORD_AAMOROS=...
SEED_PASSWORD_MZULOAGA=...
SEED_PASSWORD_JOTRUJIL=...
```

Optional variables used by services:

- FRONTEND_URL (default: https://localhost:8443)
- HOST_NAME (used by Nginx build, default localhost)

### Build and Run

From the repository root:

1. Build and start all services:

```bash
make up
```

2. Open the app:

- https://localhost:8443

3. Accept the local certificate warning if your browser asks for it.

### Useful Commands

```bash
make up           # Build and start containers
make up-no-build  # Start existing containers
make down         # Stop containers
make reload       # Restart stack
make logs         # Follow logs
make status       # Show containers/images/volumes
make fclean       # Full cleanup
```

### Seeded Users

The users service seeds five accounts on startup. Usernames are:

- femoreno
- prosas-p
- aamoros-
- mzuloaga
- jotrujil

Passwords are read from the SEED_PASSWORD_* variables in src/.env.

## Team Information

| Member Login | Assigned Role | Responsibilities |
| --- | --- | --- |
| prosas-p | Product Owner | Defined product scope, priorities, and acceptance criteria while coordinating Gateway, authentication, and game deliverables. |
| aamoros- | Project Manager | Planned milestones, coordinated delivery, and tracked execution while contributing to game development and UI implementation. |
| mzuloaga | Technical Lead | Led architecture decisions and technical reviews, and implemented key chat features plus the in-game social tab. |
| femoreno | Developer | Implemented and maintained the user database layer, profile page features, and core UI design components. |
| jotrujil | Developer | Developed chat and ranking features and delivered additional cross-cutting improvements across the project. |

## Project Management

### Work Organization

- Task distribution approach: Work was split into module-based milestones (Gateway/Auth, Game, Chat, Users/Profile, and UI), with clear ownership and peer support for cross-service integration.
- Meeting cadence (daily/weekly syncs): The team used short daily async updates and weekly sync meetings to review progress, address blockers, and adjust priorities.
- Review and merge strategy: Features were developed in dedicated branches, reviewed by teammates, and merged only after functional checks and conflict resolution.
- Definition of done and QA flow: A task was considered done when requirements were met, manual end-to-end tests passed in Docker, and the related documentation was updated.

### Tools Used

- Task tracking: WhatsApp and a shared board were used to manage backlog, in-progress work, and blockers.
- Source control workflow: Git feature-branch workflow with pull requests, descriptive commits, and peer review before merge.
- Documentation workspace: The root README and in-repository notes were used to document architecture, setup steps, and implementation decisions.

### Communication Channels

- Main channel: WhatsApp and Slack, with dedicated channels for backend, frontend, game, and project announcements.
- Async updates: Daily text updates in team channels and issue comments to keep progress visible.
- Incident/hotfix communication: Urgent issues were escalated immediately in a dedicated channel and resolved through priority branches with fast peer review.

## Technical Stack

### Frontend

- React 19
- React Router
- Vite
- Tailwind CSS
- Framer Motion
- Socket.IO Client

### Backend

- Node.js
- Express
- Socket.IO
- JSON Web Tokens (jsonwebtoken)
- bcrypt

Service layout:

- Gateway service (auth, token flow, service routing).
- Users microservice (profiles, ranking, social endpoints).
- Chat microservice (TypeScript + real-time messaging).
- Game microservice (AI and PvP game state + sockets).

### Database

- PostgreSQL 16

Why PostgreSQL:

- Relational modeling fits user/social/chat entities.
- Strong constraints and indexing support data consistency.
- Reliable transactional behavior for multi-user operations.

### Infrastructure and Other Technologies

- Docker and Docker Compose
- Nginx reverse proxy with TLS termination
- Makefile automation for common operations

### Justification of Major Technical Choices

- Microservices: clearer bounded responsibilities and easier service evolution.
- Gateway + Nginx: centralized auth/proxy logic and controlled public entrypoint.
- Socket.IO: practical real-time transport fallback and event model.
- Dockerized workflow: consistent local environment for all team members.

## Database Schema

### Visual Representation (ER-style)

```mermaid
erDiagram
    AUTH_USERS ||--o{ AUTH_FRIENDSHIPS : user_id
    AUTH_USERS ||--o{ AUTH_FRIENDSHIPS : friend_id
    AUTH_USERS ||--o{ SESSIONS_SESSIONS : user_id
    CHAT_CONVERSATIONS ||--o{ CHAT_CONVERSATION_PARTICIPANTS : conversation_id
    CHAT_CONVERSATIONS ||--o{ CHAT_MESSAGES : conversation_id
    AUTH_USERS ||--o{ CHAT_MESSAGES : sender_id

    AUTH_USERS {
        int id PK
        text email UNIQUE
        text username UNIQUE
        text password
        text avatar
        int wins
        int matches
        int score
        int rank
        timestamp created_at
    }

    SESSIONS_SESSIONS {
        int user_id PK
        text session_id
        bigint refresh_expires_at
        bigint last_access_expires_at
        bigint created_at
    }

    CHAT_CONVERSATIONS {
        int id PK
        text type
        text name UNIQUE
        bool is_public
        text description
        timestamptz created_at
    }

    CHAT_CONVERSATION_PARTICIPANTS {
        int conversation_id PK
        int user_id PK
        text role
        timestamptz joined_at
        timestamptz last_read_at
    }

    CHAT_MESSAGES {
        int id PK
        int conversation_id
        int sender_id
        text content
        text type
        timestamptz created_at
        timestamptz edited_at
    }

    AUTH_FRIENDSHIPS {
        int id PK
        int user_id
        int friend_id
        text status
        timestamptz created_at
    }
```

### Tables, Relationships, and Key Fields

- auth.users: account identity and game stats.
- sessions.sessions: active session tracking by user_id.
- chat.conversations: private and channel conversations.
- chat.conversation_participants: many-to-many user membership in conversations.
- chat.messages: message history with user/system message type.
- auth.friendships: social graph with pending/accepted/blocked statuses.

## Features List

| Feature | Description | Main Implementation Area | Team Member(s) |
| --- | --- | --- | --- |
| Authentication (Register/Login/Logout/Refresh) | User auth flow with JWT access token and refresh cookie. | gateway + users services | prosas-p, femoreno |
| Single-session enforcement | New login can force logout previous session. | gateway auth + chat force-logout | prosas-p, mzuloaga |
| User profile pages | View own profile and other users profiles. | frontend pages + users API | femoreno, aamoros- |
| Profile editing | Update username, email, password, avatar. | edit page + users routes | femoreno |
| Avatar upload | Upload and store user avatar image path. | users service (multer) | femoreno |
| Friends system | Send/accept requests and manage friend relations. | users routes + frontend profile tabs | femoreno, mzuloaga |
| Block/unblock users | Prevent interaction with blocked users. | protected routes + friends logic | mzuloaga, femoreno |
| User and channel search | Search users and public channels. | users/chat routes + frontend search views | mzuloaga, jotrujil |
| Ranking/leaderboard | Show player score/rank standings. | users ranking endpoint + landing/profile UI | jotrujil, femoreno |
| Real-time chat (DM + channels) | Create conversations, send messages, and persist history. | chat-service + ChatModule | mzuloaga, jotrujil |
| Presence indicators | Online/offline presence updates through sockets. | chat sockets + PresenceContext | mzuloaga, jotrujil |
| AI game mode | Tron-style game against AI with rotating profiles per round. | game engine + AI routes/hooks | prosas-p, aamoros- |
| PvP online game | Real-time matchmaking and live multiplayer match state. | game pvp routes + websocket layer + online page | prosas-p, aamoros- |
| Game invites from chat | Invite users to a game and notify in real time. | chat system messages + invite modal/socket events | mzuloaga, jotrujil, prosas-p |
| Terms and Privacy pages | Mandatory legal pages accessible from the app. | frontend pages and routing | aamoros-, femoreno |

## Modules

### Point Calculation (Required for this activity)

- Major module = 2 points
- Minor module = 1 point
- Total points formula:

```text
Total = (2 x number_of_major_modules) + (1 x number_of_minor_modules)
```

### Major Modules (Chosen)

| Module | Type | Activity Points | Justification | Implementation Summary | Team Member(s) |
| --- | --- | --- | --- | --- | --- |
| Web framework (frontend + backend) | Major | 2 | Needed for maintainable full-stack architecture. | React/Vite frontend with Express-based backend services. | prosas-p, aamoros-, mzuloaga, femoreno, jotrujil |
| Real-time features (WebSockets) | Major | 2 | Required for chat and live gameplay updates. | Socket.IO namespaces for gateway/chat/game real-time flows. | prosas-p, mzuloaga, jotrujil |
| Web-based game | Major | 2 | Core product deliverable: a complete browser-based multiplayer game. | Tron-style game with clear rules, win/loss conditions, and live 2D gameplay. | prosas-p, aamoros- |
| Remote players | Major | 2 | Enable two players on separate computers to play the same game in real-time. | PvP matchmaking over WebSockets with live match state synchronization between clients. | prosas-p, aamoros- |
| AI opponent | Major | 2 | Provide a solo game mode with a challenging computer-controlled opponent. | AI player implemented in the game engine that simulates human-like behavior and adapts to the match. | prosas-p, aamoros- |
| User management/authentication | Major | 2 | Mandatory identity and profile management. | Register/login, profile editing, avatar support, social features. | prosas-p, femoreno |
| DevOps microservices | Major | 2 | Separation of concerns and scalable service boundaries. | Gateway + users + chat + game behind Nginx in Docker Compose. | prosas-p, mzuloaga, aamoros- |
| User interaction | Major | 2 | Core social experience: chat, profiles, and friend relationships between users. | Real-time DM chat via Socket.IO, profile pages with game stats, and friends system with add/remove and friends list. | mzuloaga, femoreno, jotrujil |

Confirmed major points so far: 16

### Minor / Modules of Choice

Use this table to document the final minor modules selected by your team at submission time.

| Module | Type | Activity Points | Why This Module Was Chosen | How It Was Implemented | Team Member(s) | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Advanced chat features | Minor | 1 | To improve social interaction depth beyond basic messaging and connect chat with gameplay actions. | Blocking, game invites, persistent history, channel workflows. | mzuloaga, jotrujil | Implemented |
| Advanced search with filters, sorting, and pagination | Minor | 1 | To provide a richer discovery experience for users and channels beyond basic keyword matching. | Search endpoints support query filters, sort parameters, and paginated responses; frontend renders results with controls. | jotrujil, femoreno | Implemented |
| File upload management | Minor | 1 | To support profile personalization and complete user account management requirements. | Avatar upload with backend handling and profile integration. | femoreno, prosas-p | Implemented |
| Game statistics and match history | Minor | 1 | To surface competitive progression and give players a record of their performance. | Wins, losses, score, and rank tracked in the DB; leaderboard and per-user stats displayed in the profile and landing pages. | jotrujil, femoreno | Implemented |
| UI/UX and responsive refinement | Modules of choice (Minor) | 1 | To improve usability, consistency, and accessibility across key views as a custom module extending the product quality. | Shared UI components, profile/landing polish, and responsive layout adjustments. | aamoros-, femoreno | Partially implemented |

Total points after minors:

```text
16 + 4 confirmed minors = 20 (or 21 if the UI/UX minor is fully validated)
```

## Individual Contributions

This section summarizes ownership based on current team responsibilities.

| Member | Detailed Contribution Breakdown | Features / Modules / Components | Challenges Faced | How Challenges Were Overcome |
| --- | --- | --- | --- | --- |
| prosas-p | Led product scope and priorities and coordinated delivery across gateway, authentication, and gameplay layers. | Gateway routing, JWT auth flow, session logic, game integration. | Keeping authentication/session behavior consistent across multiple services. | Standardized token/session handling and validated end-to-end flows in Docker. |
| aamoros- | Managed planning and delivery cadence while contributing directly to game and UI implementation. | Game flow implementation, UI screens, milestone coordination. | Balancing feature delivery speed with UX quality and integration timing. | Broke work into milestones, prioritized blockers, and synchronized merges with the team. |
| mzuloaga | Drove technical architecture decisions and implemented core chat and social gameplay features. | Chat service features, real-time messaging behavior, in-game social tab. | Real-time synchronization and event consistency between clients/services. | Applied clear socket event patterns, room-based updates, and iterative multiplayer testing. |
| femoreno | Owned user-focused data and interface areas from persistence to profile UX. | User database logic, profile/edit pages, avatar upload, core UI design. | Maintaining data integrity while supporting profile customization and UI polish. | Added validation and consistent update flows, then verified behavior through integrated tests. |
| jotrujil | Extended social and competitive experience through chat/ranking work and broad technical support. | Chat improvements, ranking/leaderboard functionality, cross-feature fixes. | Coordinating ranking and chat updates with ongoing backend/frontend changes. | Iterative integration, targeted fixes, and regression checks after each merge cycle. |

## Resources

### Classic References

- 42 Intranet subject and evaluation documents for ft_transcendence.
- React documentation: https://react.dev
- Vite documentation: https://vite.dev
- Express documentation: https://expressjs.com
- PostgreSQL documentation: https://www.postgresql.org/docs/
- Socket.IO documentation: https://socket.io/docs/v4/
- Nginx documentation: https://nginx.org/en/docs/
- JWT introduction (RFC 7519): https://www.rfc-editor.org/rfc/rfc7519

### AI Usage Declaration

Document exactly how AI was used in this project.

| AI Tool | Task Type | Project Area | Human Verification Process | Final Decision Owner |
| --- | --- | --- | --- | --- |
| GitHub Copilot Chat (GPT-5.3-Codex) | Documentation drafting, section structuring, and wording refinement | README sections: project description, setup instructions, team/module/contribution summaries | Every generated text was manually reviewed by the team, checked against the real codebase and configuration files, and corrected when needed before merge | prosas-p (PO) and mzuloaga (Technical Lead) |
| GitHub Copilot (inline suggestions) | Code completion, refactor suggestions, and debugging support | Backend routes/services, chat and game integrations, frontend UI updates | Suggestions were never accepted blindly: each change was tested in Docker, validated functionally by the feature owner, and peer-reviewed before integration | Assigned feature owner with reviewer approval |

Recommended details to include:

- Prompts were used mainly for documentation quality, implementation clarification, and troubleshooting assistance.
- AI-assisted work touched both documentation and selected implementation areas (auth, chat, game, profile/UI).
- The team accepted only verified outputs and rejected or rewrote suggestions that were inaccurate or not aligned with project requirements.
- Correctness, security, and style were verified through manual review, integration checks, and team peer review.

## Known Limitations / Pending Improvements

Current internal TODO items include:

- Make chat and ranking areas collapsible.
- Improve tablet responsiveness for landing, online-game, and ai-game pages.
- Improve profile button UI.
- Implement/finish reconnection flow.
- Remove debug console logs/errors before final 42 submission.

## License

This project is licensed under the MIT License.
See [LICENSE](LICENSE) for the full license text.

