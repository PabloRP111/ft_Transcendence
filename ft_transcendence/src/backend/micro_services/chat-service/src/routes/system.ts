import { Router, Request, Response } from 'express';
import { getChatNamespace } from '../socket';

const router = Router();

router.post('/force-logout', (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  const chat = getChatNamespace();

  if (!chat) {
    console.error('[force-logout] socket not ready');
    return res.status(500).json({ error: 'socket not ready' });
  }

  chat.to(`user-${userId}`).emit('force-logout');

  console.log(`[force-logout] emitted for user ${userId}`);

  res.json({ ok: true });
});

export default router;