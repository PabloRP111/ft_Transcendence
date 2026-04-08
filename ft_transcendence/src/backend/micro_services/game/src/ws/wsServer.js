import { getMatch, getAllMatches, deleteMatch } from "../engine/matchStore.js";
import { stepSimulation, queuePlayerDirection } from "../engine/engine.js";

export function initSocket(io) {

  io.on("connection", (socket) => {

    socket.on("join_match", ({ matchId, playerId }) => {
      const state = getMatch(matchId);
      if (!state) return;

      if (state.mode !== "pvp") return;

      const player = state.players.find(p => p.id === playerId);
      if (!player) return;

      socket.join(matchId);

      socket.data.matchId = matchId;
      socket.data.playerId = playerId;

      // Enviar estado inicial
      socket.emit("state_update", state);
    });

    socket.on("move", ({ direction }) => {
      const { matchId, playerId } = socket.data;
      const state = getMatch(matchId);

      if (!state) return;
      if (state.status !== "playing") return;

      queuePlayerDirection(state, playerId, direction);
    });

    socket.on("disconnect", () => {
      const { matchId, playerId } = socket.data;
      const state = getMatch(matchId);
      if (!state) return;

      const player = state.players.find(p => p.id === playerId);
      if (player) player.connected = false;

      state.status = "waiting";
    });
  });

  // GAME LOOP GLOBAL PVP
  setInterval(() => {
    const matches = getAllMatches();

    Object.entries(matches).forEach(([matchId, state]) => {

      if (state.mode !== "pvp") return;
      if (state.status !== "playing") return;

      stepSimulation(state);

      io.to(matchId).emit("state_update", state);

      // Limpieza simple
      if (state.matchOver) {
        deleteMatch(matchId);
      }
    });

  }, 80);
}
