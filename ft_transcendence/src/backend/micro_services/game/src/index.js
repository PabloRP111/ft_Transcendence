import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

import gameRoutes from "./routes/gameRoutes.js";
import pvpRoutes from "./routes/pvpRoutes.js";
import { initSocket } from "./ws/wsServer.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/game", gameRoutes);
app.use("/api/pvp", pvpRoutes);

const server = http.createServer(app);

const io = new Server(server, {
  path: "/socket.io",
  cors: {
    origin: ["https://localhost:8443", "http://localhost:5173"],
    methods: ["GET", "POST"],
  },
});

initSocket(io);

const PORT = process.env.PORT || 2077;

console.log("BOOT GAME SERVICE");

server.listen(PORT, () => {
  console.log(`Game service running on ${PORT}`);
});