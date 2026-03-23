# WebSocket Architecture — Chat Service

## Las entidades del sistema

```
┌─────────────────┐         ┌────────┐         ┌──────────────┐
│    NAVEGADOR    │         │ NGINX  │         │ CHAT-SERVICE │
│                 │         │        │         │              │
│  React app      │◄───────►│        │◄───────►│  Express +   │
│  (tu frontend)  │         │        │         │  Socket.IO   │
└─────────────────┘         └────────┘         └──────────────┘
```

Hay tres entidades. El Gateway también existe pero para el chat lo hemos saltado
(Nginx habla directamente con el chat-service para los WebSockets).

---

## HTTP vs WebSocket — la diferencia clave

Hasta ahora el frontend y el backend se comunicaban con **HTTP**:

```
Navegador:   "Dame los mensajes de la conversación 5"  →→→  Chat-service
Chat-service:  ←←← "Aquí tienes: [msg1, msg2, msg3]"
               (conexión cerrada)
```

HTTP es como enviar una carta: tú preguntas, el servidor responde, se acabó.
Si quieres saber si llegó un nuevo mensaje, tienes que volver a preguntar.

**WebSocket** es como una llamada telefónica:

```
Navegador ←————————————————————————————→ Chat-service
          (conexión abierta indefinidamente)

Chat-service puede decir en cualquier momento:
  "Oye, acaba de llegar un nuevo mensaje" → Navegador
```

La conexión se abre una vez y se queda abierta. Cualquiera de los dos lados
puede mandar datos cuando quiera.

---

## ¿Quién habla con quién?

**El WebSocket conecta el navegador con el chat-service.**

```
┌─────────────────────────────┐
│         NAVEGADOR           │
│                             │
│  ┌─────────────────────┐   │
│  │   React (ChatModule) │   │
│  │   useChat.js         │   │  ← aquí vive socket.io-client
│  └──────────┬──────────┘   │
└─────────────┼───────────────┘
              │  WebSocket (conexión persistente)
              │  pasa por Nginx pero es transparente
              │
┌─────────────┼───────────────┐
│   CHAT-SERVICE              │
│             │               │
│  ┌──────────┴──────────┐   │
│  │  socket/index.ts    │   │  ← aquí vive socket.io (servidor)
│  └─────────────────────┘   │
└─────────────────────────────┘
```

---

## ¿Y socket.io-client qué es?

Socket.IO tiene **dos mitades** que tienen que coincidir:

| Mitad | Dónde vive | Qué hace |
|---|---|---|
| **socket.io** (servidor) | `chat-service/src/socket/index.ts` | Recibe conexiones, gestiona rooms, emite eventos |
| **socket.io-client** (cliente) | `frontend/src/hooks/useChat.js` | Se conecta al servidor, envía y recibe eventos |

Cuando en F0 se instaló `socket.io-client` en el frontend, se instaló exactamente esa segunda mitad.
Sin ella, el navegador no sabría cómo hablar el protocolo de Socket.IO.

Es como instalar WhatsApp en tu teléfono para poder hablar con alguien que ya tiene
un servidor de WhatsApp corriendo.

---

## El flujo completo cuando alguien envía un mensaje

```
Usuario escribe "hola" y pulsa Send
        │
        ▼
ChatModule.jsx llama a:
  socket.emit("sendMessage", { conversationId: "5", content: "hola" })
        │
        │  (WebSocket, por Nginx, hasta chat-service)
        ▼
chat-service/socket/index.ts recibe el evento "sendMessage"
  → valida que el usuario es participante
  → guarda en PostgreSQL
  → llama a: chat.to("5").emit("newMessage", { content: "hola", ... })
        │
        │  (WebSocket, a todos los sockets en la room "5")
        ▼
ChatModule.jsx de TODOS los usuarios en esa conversación
recibe el evento "newMessage" y añade el mensaje a la pantalla
```

---

## Resumen en una frase

> socket.io-client es la librería instalada en el frontend para que el **navegador**
> pueda abrir una conexión persistente con el **chat-service**, y así recibir mensajes
> en tiempo real sin tener que pedir datos constantemente.

El backend (chat-service) ya tenía su mitad desde el principio.
En F0/F3 se instaló y conectó la mitad del cliente.
