/*
The gateway validates the JWT and injects X-User-Id before forwarding the request
This middleware reads that header and decodes the userId to use in dbb requests
*/

import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

export function extractUserId(req: Request, res: Response, next: NextFunction): void {
  const userId = req.headers['x-user-id'];

  if (!userId || typeof userId !== 'string') {
    res.status(401).json({ error: 'missing user identity' });
    return;
  }

  req.userId = userId;
  next();
}
