import { getMatch, getAllMatches, deleteMatch } from "../engine/matchStore.js";
import { stepSimulation, queuePlayerDirection } from "../engine/engine.js";
import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "supersecret2";

export function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

export function initSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    
    if (!token) {
      return next(new Error("unauthorized"));
    }

    try {
      const payload = verifyAccessToken(token); 
      
      socket.data.userId = payload.id; 
      next();
    } catch (err) {
      next(new Error("unauthorized"));
    }
  });
  io.on("connection", (socket) => {
    console.log("GAME SOCKET CONNECTED");
    socket.on("join_match", ({ matchId }) => {
      const state = getMatch(matchId);
      if (!state)
         return;

      const player = state.players.find(
        p => p.userId === socket.data.userId
      );
      if (!player)
         return;

      socket.join(matchId);

      socket.data.matchId = matchId;
      socket.data.playerId = player.id;

      socket.emit("state_update", state);
    });

    socket.on("move", ({ direction }) => {
      const { matchId, playerId } = socket.data;
      const state = getMatch(matchId);

      if (!state)
        return;
      if (state.status !== "playing")
        return;

      queuePlayerDirection(state, playerId, direction);
    });

    socket.on("disconnect", () => {
      const { matchId, playerId } = socket.data;
      const state = getMatch(matchId);
      if (!state)
        return;

      const player = state.players.find(
        p => p.userId === socket.data.userId
      );
      if (player)
        player.connected = false;

      const anyConnected = state.players.some(p => p.connected);
      if (!anyConnected) {
        state.status = "waiting";
      }
    });
  });

  // GAME LOOP GLOBAL PVP
  setInterval(() => {
    const matches = getAllMatches();

    Object.entries(matches).forEach(([matchId, state]) => {

      if (state.mode !== "pvp")
        return;
      if (state.status !== "playing")
        return;

      stepSimulation(state);

      io.to(matchId).emit("state_update", state);

      if (state.matchOver) {
        deleteMatch(matchId);
      }
    });

  }, 80);
}
