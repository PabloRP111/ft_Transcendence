import express from 'express';
import { extractUserId } from './middleware/userId';
import conversationsRouter from './routes/conversations';
import messagesRouter from './routes/messages';
import systemRouter from './routes/system';

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

app.use('/conversations', conversationsRouter);
app.use('/conversations', messagesRouter);

export default app;