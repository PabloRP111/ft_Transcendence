import express from 'express';
import conversationsRouter from './routes/conversations';
import messagesRouter from './routes/messages';

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/conversations', conversationsRouter);
app.use('/conversations', messagesRouter);

export default app;
