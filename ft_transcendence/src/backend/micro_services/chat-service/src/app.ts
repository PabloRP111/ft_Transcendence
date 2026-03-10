import express from 'express';
import { authenticate } from './middleware/auth';

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

// Future routes (conversations, messages, etc.) go here.

export default app;
