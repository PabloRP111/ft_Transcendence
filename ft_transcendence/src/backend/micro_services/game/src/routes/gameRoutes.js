import express from "express";
import {
  createMatchState,
  stepSimulation,
  queuePlayerDirection,
  isMatchOver,
  getMatchWinner,
  resetRound,
} from "../engine/engine.js";
import { chooseAiDirection } from "../engine/ai.js";

const router = express.Router();

// En memoria por simplicidad; puedes usar Redis o DB para varias partidas
const matches = {};

router.post("/create", (req, res) => {
  const matchId = Date.now().toString(); // simple ID temporal
  matches[matchId] = createMatchState();
  res.json({ matchId, state: matches[matchId] });
});

router.post("/:matchId/move", (req, res) => {
  const { playerId, direction } = req.body;
  const { matchId } = req.params;

  const state = matches[matchId];
  if (!state) return res.status(404).json({ error: "Match not found" });

  if (typeof playerId !== "number") {
    return res.status(400).json({ error: "playerId must be a number" });
  }

  if (direction) {
    queuePlayerDirection(state, playerId, direction);
  }

  // IA
  const aiPlayer = state.players.find(p => p.isAi && p.alive);
  if (aiPlayer) {
    const aiDir = chooseAiDirection(state, aiPlayer);
    queuePlayerDirection(state, aiPlayer.id, aiDir);
  }

  stepSimulation(state);

  let matchOver = false;
  let winner = null;
  if (state.roundOver && isMatchOver(state)) {
    matchOver = true;
    winner = getMatchWinner(state);
  }

  res.json({ state, matchOver, winner });
});

router.post("/:matchId/reset-round", (req, res) => {
  const { matchId } = req.params;
  const state = matches[matchId];

  if (!state) {
    return res.status(404).json({ error: "Match not found" });
  }

  if (isMatchOver(state)) {
    return res.status(400).json({ error: "Match is already finished" });
  }

  resetRound(state);
  return res.json({ state });
});

export default router;