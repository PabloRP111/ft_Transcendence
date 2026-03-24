import express from "express";
import authRoutes from "./routes/authRoutes.js";
import gameRoutes from "./routes/gameRoutes.js";
import protectedRoutes from "./routes/protectedRoutes.js";
import authMiddleware from "./middleware/authMiddleware.js";
import cookieParser from "cookie-parser";
import cors from "cors";

const app = express();

app.set("trust proxy", 1);
app.use(cookieParser());
app.use(express.json());

// permitir el dev server de React
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true // para enviar cookies httpOnly
}));

// rutas públicas
app.use("/auth", authRoutes);
app.use("/game", gameRoutes);

// todo lo que sigue requiere auth
app.use(authMiddleware);

// rutas protegidas
app.use("/", protectedRoutes);

app.listen(3000, () =>
  console.log("Gateway running on port 3000")
);
