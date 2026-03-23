import express from 'express';
import { extractUserId } from './middleware/userId';
import conversationsRouter from './routes/conversations';
import messagesRouter from './routes/messages';

const app = express();

app.use(express.json());

// Public route — no auth required.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// All routes below require X-User-Id header injected by the gateway.
app.use(extractUserId);

app.use('/conversations', conversationsRouter);
app.use('/conversations', messagesRouter);

export default app;
