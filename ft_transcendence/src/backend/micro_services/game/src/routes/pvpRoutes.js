import express from "express";
import { createMatchState } from "../engine/engine.js";
import { createMatch, getMatch } from "../engine/matchStore.js";

const router = express.Router();

router.post("/create", (req, res) => {
  const matchId = Date.now().toString();

  const state = createMatchState();

  state.mode = "pvp";
  state.status = "waiting";
  state.players.forEach(p => {
    p.isAi = false;
    p.connected = false;
  });

  createMatch(matchId, state);

  res.json({ matchId });
});

router.post("/join", (req, res) => {
  const { matchId } = req.body;
  const state = getMatch(matchId);

  if (!state)
    return res.status(404).json({ error: "Match not found" });

  if (state.mode !== "pvp")
    return res.status(400).json({ error: "Not a PvP match" });

  const player = state.players.find(p => !p.connected);

  if (!player)
    return res.status(400).json({ error: "Match full" });

  player.connected = true;

  const allConnected = state.players.every(p => p.connected);

  if (allConnected) {
    state.status = "playing";
  }

  res.json({ playerId: player.id, ready: allConnected });
});

router.get("/:matchId", (req, res) => {
  const state = getMatch(req.params.matchId);

  if (!state)
    return res.status(404).json({ error: "Match not found" });

  res.json(state);
});

export default router;
