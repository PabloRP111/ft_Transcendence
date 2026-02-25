import express from "express";
import authRoutes from "./routes/authRoutes.js";
import authMiddleware from "./middleware/authMiddleware.js";
import cookieParser from "cookie-parser";
import cors from "cors";

const app = express();

app.set("trust proxy", 1);

app.use(cookieParser());

app.use(express.json());

// permitir el dev server de React
app.use(cors({
  origin: "*",
  credentials: true // para enviar cookies httpOnly
}));

// rutas públicas
app.use("/auth", authRoutes);

// Todo lo que venga despues protegido
app.use(authMiddleware);

app.get("/profile", (req, res) => {
  res.json({
    message: "Access granted",
    user: req.user,
  });
});

app.get("/me", (req, res) => {
  res.json({
    message: "Usuario autenticado",
    user: req.user
  });
});


/*
app.use("/users", usersRoutes);
app.use("/games", gamesRoutes);
app.use("/profile", profileRoutes);
*/

app.listen(3000, () =>
  console.log("Gateway running on port 3000")
);
