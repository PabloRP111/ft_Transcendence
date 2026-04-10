import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import http from "http";
import httpProxy from "http-proxy";

// Route imports
import authRoutes from "./routes/authRoutes.js";
import gameRoutes from "./routes/gameRoutes.js";
import protectedRoutes from "./routes/protectedRoutes.js";
import pvpRoutes from "./routes/pvpRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import authMiddleware from "./middleware/authMiddleware.js";

const app = express();
const server = http.createServer(app);

const proxy = httpProxy.createProxyServer({
  target: "http://game:2077",
  ws: true,
});

server.on("upgrade", (req, socket, head) => {
  proxy.ws(req, socket, head);
});

// Required for secure cookies when running behind a proxy (Nginx)
app.set("trust proxy", 1);

app.use(cookieParser());
app.use(express.json());

// CORS configuration supporting both Production (8443) and Dev Server (5173)
app.use(cors({
  origin: ["https://localhost:8443", "http://localhost:5173"],
  credentials: true
}));

// Public routes
app.use("/auth", authRoutes);
app.use("/game", gameRoutes);

// Auth middleware
app.use(authMiddleware);

// Protected routes
app.use("/", protectedRoutes);
app.use("/pvp", pvpRoutes);
app.use("/chat", chatRoutes);

server.listen(3000, () => {
  console.log("Gateway running on port 3000");
});
