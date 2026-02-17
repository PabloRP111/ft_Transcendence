import express from "express";
import { loginUser, registerUser } from "../services/usersClient.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  storeRefreshToken,
  findRefreshToken,
  rotateRefreshToken,
  deleteRefreshToken
} from "../jwt.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  const { email, username, password } = req.body;

  if (!email || !username || !password)
    return res.status(400).json({ error: "Missing fields" });

  try {
    const user = await registerUser(email, username, password);

    res.status(201).json({
      id: user.id,
      email: user.email,
      username: user.username,
    });

  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});


router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Missing credentials" });

  const user = await loginUser(email, password);
  if (!user)
    return res.status(401).json({ error: "Invalid credentials" });

  const accessToken = generateAccessToken(user);

  const { token: refreshToken, payload } = generateRefreshToken(user);
  await storeRefreshToken(user.id, refreshToken, payload.exp);

  res.json({ accessToken, refreshToken });
});

router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken)
    return res.status(401).json({ error: "Missing refresh token" });

  try {
    // Buscar el token en la DB primero
    const storedToken = await findRefreshToken(refreshToken);
    if (!storedToken)
      return res.status(401).json({ error: "Invalid refresh token" });

    // Verificar la firma JWT
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      // Si la firma no es válida, eliminar de la DB por seguridad
      await deleteRefreshToken(refreshToken);
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    // Comprobar expiración en DB
    if (storedToken.expires_at < Math.floor(Date.now() / 1000)) {
      await deleteRefreshToken(refreshToken);
      return res.status(401).json({ error: "Refresh token expired" });
    }

    // Generar nuevos tokens
    const newAccessToken = generateAccessToken({ id: decoded.id, email: decoded.email });
    const { token: newRefreshToken, payload: newRefreshPayload } = generateRefreshToken({ id: decoded.id });

    // Rotar refresh token en la DB (revoca el viejo y guarda el nuevo)
    await rotateRefreshToken(refreshToken, newRefreshToken, decoded.id, Math.floor(newRefreshPayload.exp));

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/logout", async (req, res) => {
  const { refreshToken} = req.body;

  if (!refreshToken)
  return res.status(400).json({ error: "Refresh token required" });

  await deleteRefreshToken(refreshToken);

  res.json({ message: "Logged out" });
});

export default router;
