import express from 'express';
import { extractUserId } from './middleware/userId';
import conversationsRouter from './routes/conversations';
import messagesRouter from './routes/messages';
import systemRouter from './routes/system';

const app = express();

app.use(express.json());
app.use('/system', systemRouter);

// All routes below require X-User-Id header injected by the gateway.
app.use(extractUserId);

app.use('/conversations', conversationsRouter);
app.use('/conversations', messagesRouter);

export default app;
