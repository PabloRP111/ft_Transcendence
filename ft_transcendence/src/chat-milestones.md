# ft_Transcendence — Roadmap & Milestones


## Estado actual

### Chat ✅ Completo (base)
- Send/receive mensajes en tiempo real (WebSocket)
- Historial persistido en DB
- Typing indicators
- Unread badges (offline + real-time)
- Arena_General auto-join
- Canales públicos (crear, buscar, unirse)
- DMs
- Inbox ordenado por último mensaje

### Profile ⚠️ Parcial
- Vista propia con stats (wins, matches, score, rank)
- Botón edit existe pero no funciona
- No hay `/profile/:id` para ver perfiles ajenos
- No hay avatar real

### Friends ❌ No existe

---

## Milestones pendientes

---

### M5 — Profile system completo
**Prioridad: CRÍTICA (Major)**
**Donde: frontend `src/pages/Profile.jsx` + backend `users-service`**

#### Backend
- [ ] `PATCH /users/:id` — editar username (y avatar si se implementa)
- [ ] El `GET /users/:id` ya existe, verificar que devuelve todo lo necesario

#### Frontend
- [ ] Tabs en Profile: **[Stats] [Friends] [History]**
- [ ] `/profile` → perfil propio con botón Edit funcional
- [ ] `/profile/:id` → perfil ajeno: sin Edit, con botones **[Add Friend]** / **[DM]**
- [ ] Indicador de presencia online/offline junto al username (● verde / ○ gris)
- [ ] Tab **History**: lista de partidas jugadas (vs quién, resultado W/L, fecha)
- [ ] Editar username: modal/inline con input + confirm

#### Diseño `/profile` (propio)
```
┌──────────────────────────────────────────┐
│                          [✏ Edit]        │
│         ◯ avatar                         │
│      USERNAME                            │
│      Grid Competitor  ● online           │
│                                          │
│  [Stats]  [Friends]  [History]           │
│  ──────────────────────────────          │
│  Wins │ Matches │ Score │ Rank           │
└──────────────────────────────────────────┘
```

#### Diseño `/profile/:id` (ajeno)
```
┌──────────────────────────────────────────┐
│  [← back]                               │
│         ◯ avatar                         │
│      USERNAME                            │
│      Grid Competitor  ● online           │
│                                          │
│  [+ Add Friend]  [DM]                   │
│                                          │
│  [Stats]  [History]                      │
│  ──────────────────────────────          │
│  Wins │ Matches │ Score │ Rank           │
└──────────────────────────────────────────┘
```

---

### M6 — Friends system
**Prioridad: CRÍTICA (Major)**
**Donde: backend `users-service` + frontend `Profile.jsx` (tab Friends)**

#### Backend
- [ ] Tabla `auth.friendships` (user_id, friend_id, status: pending/accepted/blocked)
- [ ] `POST /users/friends/request/:targetId` — enviar solicitud
- [ ] `POST /users/friends/accept/:requesterId` — aceptar
- [ ] `POST /users/friends/decline/:requesterId` — rechazar
- [ ] `DELETE /users/friends/:friendId` — eliminar amigo
- [ ] `GET /users/friends` — lista de amigos (+ estado online si disponible)
- [ ] `GET /users/friends/pending` — solicitudes pendientes recibidas

#### Frontend — tab Friends en `/profile` propio
```
┌──────────────────────────────────────────┐
│  [Stats]  [Friends ●3]  [History]        │
│  ──────────────────────────────          │
│  ONLINE                                  │
│  ● userA          [DM]  [Invite ▶]      │
│  ● userC          [DM]  [Invite ▶]      │
│                                          │
│  OFFLINE                                 │
│  ○ userB          [DM]                  │
│                                          │
│  PENDING (recibidas)                     │
│  userD  [✓ Accept]  [✗ Decline]         │
└──────────────────────────────────────────┘
```

#### Notas
- Badge en la tab Friends si hay solicitudes pendientes
- [Invite ▶] solo habilitado si el amigo está online (Minor — ver M9)
- [DM] abre el chat directamente con ese usuario

---

### M7 — Presencia online (infraestructura)
**Prioridad: ALTA (necesaria para M6 y M8)**
**Donde: `chat-service` (backend) + `users-service` o gateway**

El chat-service ya tiene un `presence` Map en memoria (userId → Set de socket IDs).
Solo hay que exponerlo como endpoint.

- [ ] `GET /chat/online` — devuelve array de userIds online (desde el presence map)
  - Requiere autenticación (JWT via gateway)
- [ ] Frontend: al cargar friends list, hacer GET /chat/online y marcar quién está online
- [ ] Actualizar estado en tiempo real: los eventos `userOnline`/`userOffline` del socket
  ya se emiten — suscribirse a ellos en el contexto global (no solo en ChatModule)

---

### M8 — ChatModule: mejoras de social
**Prioridad: ALTA (Major + UX)**
**Donde: `src/components/chat/` + `ChatView.jsx` + `InboxView.jsx`**

#### Online status en inbox (DMs)
- [ ] Dot verde para DMs con usuario online, gris si offline
- [ ] Canales grupales: sin dot de presencia (no aplica)
- [ ] Prioridad visual: naranja (unread) > verde (online) > gris

#### Acciones desde el chat
- [ ] Header de ChatView en DM: botón **[+ Friend]** si no son amigos, **[✓]** si ya lo son
- [ ] Header de ChatView en DM: acceso al `/profile/:id` del otro usuario (clic en el nombre)
- [ ] Inbox: botón **[Leave]** en canales de los que el usuario es miembro (no en DMs)
  - Backend: `DELETE /conversations/:id/participants` — salir de un canal

#### Diseño header ChatView (DM)
```
┌────────────────────────────────────────┐
│  [←]  username  ● online   [👤] [+👥] │
└────────────────────────────────────────┘
```

#### Diseño inbox con leave
```
┌──────────────────────────────┐
│  # Arena_General             │
│  ──────────────────────────  │
│  # canal-publico    [Leave]  │
│  ◉ userA (DM)    ● [●unread] │
└──────────────────────────────┘
```

---

### M9 — Minor module: Advanced chat
**Prioridad: MEDIA (requiere M5+M6+M7+M8 completos)**
**Donde: chat-service socket + frontend ChatView + friends list**

- [ ] **Block user**: `POST /users/block/:targetId` — bloquear usuario
  - Mensajes de usuario bloqueado no se muestran (filtrado en backend al persistir)
  - En perfil ajeno: botón [Block] junto a [Add Friend]
- [ ] **Game invite desde chat**: botón [Invite ▶] en header de DM (si online)
  - Socket event `gameInvite { toUserId }` → receptor ve modal Accept/Decline
  - Reutilizable desde friends list (M6)
- [ ] **Game/tournament notifications en chat**: mensaje de sistema en Arena_General
  cuando empieza un torneo o hay partida disponible
- [ ] **Access user profile from chat**: clic en username del mensaje → `/profile/:id`
- [ ] **Read receipts**: marcar mensajes como leídos (requiere `last_read_at` en DB)

---

## Orden de implementación recomendado

```
M7 (presencia endpoint)        ← 1-2h, desbloquea todo lo social
    ↓
M5 (profile completo)          ← 3-4h, Major requirement
    ↓
M6 (friends system)            ← 4-6h, Major requirement
    ↓                              ← MAJOR COMPLETO AQUÍ
M8 (chat social features)      ← 2-3h, UX + Minor prep
    ↓
M9 (advanced chat)             ← 3-4h, Minor module
                                   ← MINOR COMPLETO AQUÍ
```

---

## Backend contract (completo)

### chat-service (via `/api/chat/`)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/conversations` | Crear DM o canal |
| GET | `/conversations` | Listar conversaciones del usuario |
| GET | `/conversations/search?q=` | Buscar canales públicos |
| POST | `/conversations/:id/participants` | Unirse a canal |
| DELETE | `/conversations/:id/participants` | Salir de canal *(pendiente)* |
| GET | `/conversations/:id/messages` | Historial paginado |
| POST | `/conversations/:id/messages` | Enviar mensaje (REST fallback) |
| PATCH | `/conversations/:id/messages/:msgId` | Editar mensaje |
| GET | `/online` | Usuarios online *(pendiente)* |

### users-service (via `/api/`)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/me` | Perfil propio |
| GET | `/users/:id` | Perfil ajeno |
| GET | `/users/search?q=` | Buscar usuarios |
| PATCH | `/users/:id` | Editar perfil *(pendiente)* |
| POST | `/users/friends/request/:id` | Enviar solicitud *(pendiente)* |
| POST | `/users/friends/accept/:id` | Aceptar solicitud *(pendiente)* |
| DELETE | `/users/friends/:id` | Eliminar amigo *(pendiente)* |
| GET | `/users/friends` | Lista de amigos *(pendiente)* |
| GET | `/users/friends/pending` | Solicitudes pendientes *(pendiente)* |
| POST | `/users/block/:id` | Bloquear usuario *(pendiente)* |

### Socket events — nuevos *(pendientes)*
| Dirección | Evento | Payload |
|---|---|---|
| client → server | `gameInvite` | `{ toUserId }` |
| server → client | `gameInviteReceived` | `{ fromUserId, fromUsername }` |
| server → client | `gameInviteAccepted` | `{ userId }` |
| server → client | `gameInviteDeclined` | `{ userId }` |
