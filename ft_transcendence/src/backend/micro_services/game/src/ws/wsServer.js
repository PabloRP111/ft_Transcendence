import { getMatch, getAllMatches, deleteMatch } from "../engine/matchStore.js";
import { stepSimulation, queuePlayerDirection,resetRound } from "../engine/engine.js";
import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "IOS is overrated";
const USERS_SERVICE_URL = "http://users:3002";

async function fetchUser(userId) {
  const res = await fetch(`${USERS_SERVICE_URL}/${userId}`);
  if (!res.ok)
    return null;
  return res.json();
}

async function postMatchResult(results) {
  if (!results.length)
    return;

  const res = await fetch(`${USERS_SERVICE_URL}/match-result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ results })
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Failed to update scores:", res.status, text);
  }
}

function buildScoreResults(state) {
  const players = state.players.filter(p => p.userId);
  if (players.length < 2)
    return [];

  if (state.winner) {
    const winner = players.find(p => p.id === state.winner.id);
    const loser = players.find(p => p.id !== state.winner.id);
    const results = [];

    if (winner) results.push({ userId: winner.userId, delta: 100, win: true });
    if (loser) results.push({ userId: loser.userId, delta: -50, win: false });

    return results;
  }

  return players.map(p => ({ userId: p.userId, delta: 50, win: false }));
}

export function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

export function initSocket(io) {
  const game = io.of("/game");

  game.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("unauthorized"));
    }

    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = String(payload.id);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  game.on("connection", (socket) => {
    console.log("GAME SOCKET CONNECTED");

    socket.on("join_match", async ({ matchId }) => {
      const state = getMatch(matchId);
      if (!state) return;

      const player =
        state.players.find(p => p.userId === socket.data.userId) ||
        state.players.find(p => !p.userId);

      if (!player) return;

      player.userId = socket.data.userId;
      player.connected = true;

      socket.join(matchId);

      socket.data.matchId = matchId;
      socket.data.playerId = player.id;

      const user = await fetchUser(socket.data.userId);

      if (user) {
        player.name = user.username;
        player.avatar = user.avatar || null;
      }

      const allConnected = state.players.every(p => p.connected);
      if (allConnected) {
        state.status = "playing";
      }

      game.to(matchId).emit("state_update", state);
    });

    socket.on("move", ({ direction }) => {
      const { matchId, playerId } = socket.data;
      const state = getMatch(matchId);

      if (!state) return;
      if (state.status !== "playing") return;

      queuePlayerDirection(state, playerId, direction);
    });

    socket.on("connect_error", (err) => {
      console.error("SOCKET ERROR:", err.message);
    });

    socket.on("disconnect", () => {
      const { matchId } = socket.data;
      const state = getMatch(matchId);
      if (!state) return;

      const player =
        state.players.find(p => p.userId === socket.data.userId) ||
        state.players.find(p => !p.userId);

      if (!player) return;

      player.userId = socket.data.userId;
      player.connected = false;

      const anyConnected = state.players.some(p => p.connected);
      if (!anyConnected) {
        state.status = "waiting";
      }

      if (matchId) {
        socket.leave(matchId);
      }
    });
  });

  setInterval(async () => {
    const matches = getAllMatches();

    for (const [matchId, state] of Object.entries(matches)) {

      if (state.mode !== "pvp") continue;
      if (state.status !== "playing") continue;

      stepSimulation(state);

      if (state.roundOver && !state.matchOver && !state._resetScheduled) {
        state._resetScheduled = true;

        setTimeout(() => {
          resetRound(state);
          state._resetScheduled = false;
          game.to(matchId).emit("state_update", state);
        }, 1500);
      }

      game.to(matchId).emit("state_update", state);

      if (state.matchOver) {
        if (!state._scoreCommitted) {
          state._scoreCommitted = true;
          const results = buildScoreResults(state);
          await postMatchResult(results);
        }
        game.in(matchId).disconnectSockets(true);
        deleteMatch(matchId);
      }
    }

  }, 80);
}
