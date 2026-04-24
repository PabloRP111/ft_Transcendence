import express from "express";
import { createMatchState } from "../engine/engine.js";
import { createMatch, getMatch, getAllMatches } from "../engine/matchStore.js";

const router = express.Router();

// Helper
function getUserId(req) {
  const userId = req.headers["x-user-id"];
  if (!userId) return null;
  return userId.toString();
}

// CREATE MATCH
router.post("/create", (req, res) => {
  const userId = getUserId(req);
  if (!userId)
    return res.status(401).json({ error: "Unauthorized" });

  const matchId = Date.now().toString();

  const state = createMatchState();

  state.mode = "pvp";
  state.status = "waiting";

  // Inicialize owner player
  state.players.forEach(p => {
    p.isAi = false;
    p.connected = false;
    p.userId = null;
  });

  createMatch(matchId, state);

  res.json({ matchId });
});

// JOIN MATCH
router.post("/join", (req, res) => {
  const userId = getUserId(req);
  if (!userId)
    return res.status(401).json({ error: "Unauthorized" });

  const { matchId } = req.body;
  const state = getMatch(matchId);

  if (!state)
    return res.status(404).json({ error: "Match not found" });

  if (state.mode !== "pvp")
    return res.status(400).json({ error: "Not a PvP match" });

  // RECONECTION
  let player = state.players.find(p => p.userId === userId);
  if (player) {
    player.connected = true;
    let allConnected = state.players.every(p => p.connected);
    if (state.status === "paused" && allConnected) {
      state.status = "playing";
      state.pause.active = false;
    }
    return res.json({ playerId: player.id, ready: allConnected });
  }

  // NEW PLAYER
  player = state.players.find(p => !p.userId);

  if (!player)
    return res.status(400).json({ error: "Match full" });

  player.userId = userId;
  player.connected = true;

  const allConnected = state.players.every(p => p.connected);

  if (allConnected) {
    state.status = "playing";
  }

  res.json({ playerId: player.id, ready: allConnected });
});

// GET MATCH STATE
router.get("/:matchId", (req, res) => {
  const userId = getUserId(req);
  if (!userId)
    return res.status(401).json({ error: "Unauthorized" });

  const state = getMatch(req.params.matchId);

  if (!state)
    return res.status(404).json({ error: "Match not found" });

  const isPlayer = state.players.some(p => p.userId === userId);

  if (!isPlayer)
    return res.status(403).json({ error: "Forbidden" });

  res.json(state);
});

router.post("/matchmaking", (req, res) => {
  const userId = getUserId(req);
  if (!userId)
    return res.status(401).json({ error: "Unauthorized" });

  const matches = getAllMatches();

  const openMatch = Object.entries(matches).find(([_, state]) => {
    return state.mode === "pvp" && state.status === "waiting";
  });

  if (openMatch) {
    const [matchId] = openMatch;
    return res.json({ matchId });
  }

  const matchId = Date.now().toString();
  const state = createMatchState();

  state.mode = "pvp";
  state.status = "waiting";

  state.players.forEach(p => {
    p.isAi = false;
    p.connected = false;
    p.userId = null;
  });

  createMatch(matchId, state);

  return res.json({ matchId });
});

export default router;
