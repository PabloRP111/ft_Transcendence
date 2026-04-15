import { verifyAccessToken, findSessionByUser } from "../jwt.js";

export default async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer "))
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

  if (!payload)
    return res.status(401).json({ error: "Invalid token payload" });

  const session = await findSessionByUser(payload.id);
  if (!session)
    return res.status(401).json({ error: "No session" });

  // Active session validation
  if (payload.session_id !== session.session_id)
    return res.status(401).json({ error: "Invalid session" });

  req.user = payload;
  next();
}
