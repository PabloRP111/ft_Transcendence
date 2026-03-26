import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

// Route imports
import authRoutes from "./routes/authRoutes.js";
import gameRoutes from "./routes/gameRoutes.js";
import protectedRoutes from "./routes/protectedRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import authMiddleware from "./middleware/authMiddleware.js";

const app = express();

// Required for secure cookies when running behind a proxy (Nginx)
app.set("trust proxy", 1);

app.use(cookieParser());
app.use(express.json());

// CORS configuration supporting both Production (8443) and Dev Server (5173)
app.use(cors({
  origin: ["https://localhost:8443", "http://localhost:5173"],
  credentials: true // Required for sending httpOnly cookies
}));

// Public routes
app.use("/auth", authRoutes);
app.use("/game", gameRoutes); // Restored from teammate's version

// Authentication middleware - All routes below this line require valid auth
app.use(authMiddleware);

// Protected routes
app.use("/", protectedRoutes);
app.use("/chat", chatRoutes);

app.listen(3000, () =>
  console.log("Gateway running on port 3000")
);