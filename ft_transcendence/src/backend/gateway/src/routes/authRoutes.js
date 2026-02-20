import express from "express";
import { loginUser, registerUser } from "../services/usersClient.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  storeRefreshToken,
  findRefreshToken,
  deleteRefreshToken,
  hashToken
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

  const { token: refreshToken, exp } = generateRefreshToken(user);

  await storeRefreshToken(user.id, hashToken(refreshToken), exp);


  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  console.log({ refreshToken, hashed: hashToken(refreshToken), exp });

  res.json({ accessToken });
});

router.post("/refresh", async (req, res) => {
  console.log("HEADERS COOKIE:", req.headers.cookie);
  console.log("PARSED COOKIES:", req.cookies);
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken)
    return res.status(401).json({ error: "Missing refresh token" });

  try {
    // Buscar el token en la DB primero
    const hashed = hashToken(refreshToken);
    const storedToken = await findRefreshToken(hashed);
    if (!storedToken)
      return res.status(401).json({ error: "Invalid refresh token 1" });

    // Verificar la firma JWT
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      // Si la firma no es válida, eliminar de la DB por seguridad
      await deleteRefreshToken(hashToken(refreshToken));
      return res.status(401).json({ error: "Invalid refresh token 2" });
    }

    // Comprobar expiración en DB
    if (storedToken.expires_at < Math.floor(Date.now() / 1000)) {
      await deleteRefreshToken(hashToken(refreshToken));
      return res.status(401).json({ error: "Refresh token expired" });
    }

    // Generar nuevos tokens
    const newAccessToken = generateAccessToken({id: decoded.id });

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/logout", async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (refreshToken)
    await deleteRefreshToken(hashToken(refreshToken));

  res.clearCookie("refreshToken");

  res.json({ message: "Logged out" });
});


export default router;
