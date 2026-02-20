import { verifyAccessToken } from "../jwt.js";

export default function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer "))
    return res.status(401).json({ error: "Missing token" });

  const token = authHeader.split(" ")[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
