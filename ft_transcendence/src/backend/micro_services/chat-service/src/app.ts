import express from 'express';
import { authenticate } from './middleware/auth';
import conversationsRouter from './routes/conversations';
import messagesRouter from './routes/messages';

const app = express();

// Parse incoming request bodies as JSON.
// Without this, req.body would be undefined for POST/PATCH requests.
app.use(express.json());

// Public route — no auth required.
// Must be registered BEFORE the authenticate middleware below.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Apply JWT authentication to every route registered after this line.
// Any handler below this point can safely read req.userId.
app.use(authenticate);

// POST /conversations, GET /conversations
app.use('/conversations', conversationsRouter);

// POST /conversations/:conversationId/messages
// GET  /conversations/:conversationId/messages
app.use('/conversations', messagesRouter);

export default app;
