import express from 'express';
import { extractUserId } from './middleware/userId';
import conversationsRouter from './routes/conversations';
import messagesRouter from './routes/messages';
import systemRouter from './routes/system';
import { getPresence } from './socket';

const app = express();

app.use(express.json());

// PUBLIC ROUTES — No authentication required
// Health check for Docker/Kubernetes monitoring
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// System routes (e.g., /system/force-logout)
// These are usually called internally by the Gateway
app.use('/system', systemRouter);

// AUTHENTICATED ROUTES
// All routes below require X-User-Id header injected by the gateway.
app.use(extractUserId);

// Returns the list of userIds currently online (present in the in-memory map).
// The map is populated on socket connect and cleaned up on disconnect.
app.get('/online', (_req, res) => {
  const onlineUserIds = Array.from(getPresence().keys());
  res.json(onlineUserIds);
});

app.use('/conversations', conversationsRouter);
app.use('/conversations', messagesRouter);

export default app;