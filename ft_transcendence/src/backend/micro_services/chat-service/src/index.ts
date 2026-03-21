import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import app from './app';
import { attachSocketIO } from './socket';

const PORT = process.env.PORT ?? 3003;

const server = http.createServer(app);
attachSocketIO(server);

server.listen(PORT, () => {
  console.log(`chat-service listening on port ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('[server] SIGTERM received — shutting down gracefully');
  server.close(() => {
    console.log('[server] closed');
    process.exit(0);
  });
});
