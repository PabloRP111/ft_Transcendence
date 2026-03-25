import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import protectedRoutes from "./routes/protectedRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import authMiddleware from "./middleware/authMiddleware.js";

const app = express();

app.use(cookieParser());
app.use(express.json());
app.use(cors({ origin: "https://localhost:8443", credentials: true }));

app.use("/auth", authRoutes);
app.use(authMiddleware);
app.use("/", protectedRoutes);
app.use("/chat", chatRoutes);

app.listen(3000, () => console.log("Gateway running on port 3000"));
