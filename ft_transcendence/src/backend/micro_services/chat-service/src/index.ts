/**
 * index.ts — arranque del chat-service
 *
 * Levanta un HTTP server mínimo + Socket.IO para /chat.
 * El gateway pasa el userId en el handshake; no hay JWT aquí.
 */

import express from 'express';
import http from 'http';
import { attachSocketIO } from './socket';

const app = express();

// Parse JSON si algún día hay endpoints adicionales
app.use(express.json());

// Crear HTTP server explícito para Socket.IO
const server = http.createServer(app);

// Adjuntamos Socket.IO al server
attachSocketIO(server);

// Puerto configurable vía env (gateway decide cuál usar)
const PORT = process.env.CHAT_SERVICE_PORT ? parseInt(process.env.CHAT_SERVICE_PORT) : 3003;

server.listen(PORT, () => {
  console.log(`chat-service running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[server] SIGTERM received — shutting down gracefully');
  server.close(() => {
    console.log('[server] closed');
    process.exit(0);
  });
});