import { verifyAccessToken, findSessionByUser } from "../jwt.js";

export default async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer "))
    return res.status(401).json({ error: "Missing token" });

  const token = authHeader.split(" ")[1];
  if (!token)
    return res.status(401).json({ error: "Missing access token" });

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return res.status(401).json({ error: "Invalid access token" });
  }

  const session = await findSessionByUser(payload.id);
  if (!session)
    return res.status(401).json({ error: "No session" });

  // SOLO el último access token es válido
  if (payload.expMs !== session.last_access_expires_at)
    return res.status(401).json({ error: "Session replaced" });

  req.user = payload;
  next();
}
