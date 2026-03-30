# ft_Transcendence — Roadmap & Milestones

## Estado actual (2026-03-30)

### M8 ✅ Chat social features (completo)
- `DELETE /conversations/:id/participants` — leave canal (guards: no DMs, no Arena_General)
- `leaveChannel()` en `api/chat.js`
- Icono Leave en InboxView (hover, excluye Arena_General y DMs)
- Botón Leave en ChatView header (excluye Arena_General y DMs)
- Clic en username del mensaje → `/profile/:username`
- Clic en nombre del header en DMs → `/profile/:username`
- `?channel=convId` — navegación directa a canal desde URL (mismo patrón que `?dm=userId`)

### M11 ✅ Tab Social en `/profile` propio (completo)
- Tab "Friends" renombrado a "Social"
- Sección Friends: online/offline, pending requests con Accept/Decline
- Sección Channels: lista de canales propios (excl. Arena_General) con botón Leave y navegación al canal
- Search bar con debounce — busca usuarios y canales en paralelo
- Resultados: botón Add Friend (con feedback "Sent") + botón DM para usuarios; botón Join (con feedback "Joined") para canales

### M7 ✅ Presencia online (completo)
- `GET /chat/online` — endpoint REST que expone el presence map en memoria
- `PresenceContext` global — fetch inicial + suscripción a `userOnline`/`userOffline`
- `SocketContext` actualizado — ahora expone `{ socketRef, connected }` (BREAKING: cualquier código que haga `const socketRef = useSocket()` debe cambiar a `const { socketRef } = useSocket()`)
- Dot verde/gris en InboxView (DMs) con prioridad: naranja (unread) > verde (online) > gris
- Indicador online/offline en ChatView header (DMs)

### M5 ✅ Profile system (completo)
- `PUT /:id` en users-service — editar username, email, password
- `GET /users/:id` y `GET /users/by-username/:username` en gateway
- `/profile/:username` — perfil ajeno con stats, online indicator, botones DM y Add Friend
- `/edit` — editar perfil propio (pre-carga datos actuales)
- Rutas `/profile/:id` y `/edit` registradas y protegidas en App.jsx
- Botón DM desde perfil → abre ChatView directamente vía `?dm=userId`

### M6 ✅ Friends system (completo)
- Tabla `auth.friendships` (user_id, friend_id, status: pending/accepted/blocked)
- 7 endpoints en users-service: GET /friends, GET /friends/pending, GET /friends/status/:id, POST /friends/request/:id, POST /friends/accept/:id, POST /friends/decline/:id, DELETE /friends/:id
- Proxies en gateway para todos los endpoints
- `api/friends.js` en frontend
- Botón Add Friend / Pending / Friends / Remove en `/profile/:username` con estados reactivos
- Tab Friends en `/profile` propio: lista online/offline, solicitudes pendientes con Accept/Decline, badge de notificación, botón DM por amigo

### Chat ✅ Base completa
- Send/receive mensajes en tiempo real (WebSocket)
- Historial persistido en DB
- Typing indicators
- Unread badges (offline + real-time)
- Arena_General auto-join
- Canales públicos (crear, buscar, unirse)
- DMs — find-or-create (fix: ya no genera duplicados)
- Inbox ordenado por último mensaje
- Botón DM desde perfil ajeno abre ChatView directamente

---

## Milestones pendientes

### M9 — Minor module: Advanced chat
**Prioridad: MEDIA (requiere M8 completo)**

- [ ] **Block user**: `POST /users/block/:targetId`
  - Mensajes de usuario bloqueado no se muestran en el chat
  - Botón Block en `/profile/:username` (junto a Add Friend)
  - Backend: filtrado al persistir/devolver mensajes (chat-service consulta a users-service o tabla compartida)
- [ ] **Game invite desde chat**: botón Invite en header DM (si el otro está online)
  - Socket event `gameInvite { toUserId }` → receptor ve modal Accept/Decline
  - Si acepta, ambos son redirigidos a la partida
  - Reutilizable desde Friends list en `/profile`
- [ ] **Tournament notifications** en Arena_General (mensaje de sistema)

---

### M10 — Match history
**Prioridad: MEDIA**
**Donde: `game-service` backend + `/profile/:username` + `/profile` propio (tab "History")**

- [ ] **Persistir resultados de partidas** en game-service
  - Tabla `game.matches (id, player1_id, player2_id, score_p1, score_p2, played_at)`
  - Endpoint `GET /game/matches?userId=` — historial de un usuario
  - Proxy en gateway
- [ ] **Tab "History" en `/profile`** (propio) y en `/profile/:username` (ajeno)
  - Lista de partidas: oponente (clicable → su perfil), fecha, score, W/L
- [ ] **Stats básicas**: partidas jugadas, victorias, derrotas, winrate

---

### M11 — Profile: mejoras pendientes
**Prioridad: MEDIA**

- [ ] **Canales en perfil ajeno** `/profile/:username` (solo públicos, sin botón Leave)
  - Nuevo endpoint: `GET /conversations/user/:userId` en chat-service
  - Proxy en gateway
- [ ] **Add Friend desde ChatView header** — botón en header del DM si no son amigos aún
  - Usar `getFriendStatus(userId)` + `sendFriendRequest(userId)` ya implementados
- [ ] **Remove friend** — botón en tab Social (lista de amigos) y en `/profile/:username`
  - `DELETE /friends/:id` ya existe en backend

---

## Arquitectura actual

### Contextos React globales
```
AuthProvider
  └── SocketProvider        → { socketRef, connected }
        └── PresenceProvider → Set<userId> de usuarios online
              └── BrowserRouter
```

**IMPORTANTE**: `useSocket()` devuelve `{ socketRef, connected }`, no solo el ref.
Cualquier consumidor debe destructurar: `const { socketRef } = useSocket()`

### Socket flow
```
Frontend → Nginx (/socket.io/) → chat-service (/chat namespace)
```
El gateway NO interviene en el socket. Solo en REST.

### REST flow
```
Frontend → Nginx (/api/) → Gateway (valida JWT, inyecta X-User-Id) → microservicio
```

---

## Backend contract (estado actual)

### chat-service (via `/api/chat/`)
| Método | Ruta | Estado |
|---|---|---|
| POST | `/conversations` | ✅ find-or-create (DMs y canales) |
| GET | `/conversations` | ✅ |
| GET | `/conversations/search?q=` | ✅ |
| POST | `/conversations/:id/participants` | ✅ unirse a canal |
| DELETE | `/conversations/:id/participants` | ✅ leave canal |
| GET | `/conversations/user/:userId` | ❌ pendiente (M11 canales en perfil ajeno) |
| GET | `/conversations/:id/messages` | ✅ |
| PATCH | `/conversations/:id/messages/:msgId` | ✅ |
| GET | `/online` | ✅ usuarios online |

### users-service (via `/api/`)
| Método | Ruta | Estado |
|---|---|---|
| GET | `/me` | ✅ |
| PUT | `/me` | ✅ |
| GET | `/users/:id` | ✅ |
| GET | `/users/by-username/:username` | ✅ |
| GET | `/users/search?q=` | ✅ |
| GET | `/friends` | ✅ |
| GET | `/friends/pending` | ✅ |
| GET | `/friends/status/:id` | ✅ |
| POST | `/friends/request/:id` | ✅ |
| POST | `/friends/accept/:id` | ✅ |
| POST | `/friends/decline/:id` | ✅ |
| DELETE | `/friends/:id` | ✅ |
| POST | `/users/block/:id` | ❌ pendiente (M9) |
| GET | `/game/matches` | ❌ pendiente (M10) |

### Socket events
| Dirección | Evento | Estado |
|---|---|---|
| server → client | `userOnline` | ✅ |
| server → client | `userOffline` | ✅ |
| server → client | `force-logout` | ✅ |
| client → server | `gameInvite` | ❌ pendiente (M9) |
| server → client | `gameInviteReceived` | ❌ pendiente (M9) |
| client → server | `gameInviteAccept` | ❌ pendiente (M9) |
| client → server | `gameInviteDecline` | ❌ pendiente (M9) |

---

## DB — tablas relevantes

### auth.friendships (nueva en M6)
```sql
CREATE TABLE auth.friendships (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id  INTEGER NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, friend_id)
);
```
**Si alguien hace `docker compose down -v` necesita ejecutar `05-friendships.sql` manualmente.**

---

## Orden recomendado

```
M9  (advanced chat)  ← block + game invites
M10 (match history)  ← independiente, requiere trabajo en game-service
M11 (profile extras) ← canales en perfil ajeno, add friend desde chat, remove friend
```
