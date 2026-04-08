import express from "express";
import { GRID_WIDTH, GRID_HEIGHT, CELL_SIZE, PLAYER_COLORS, TICK_MS, STARTING_LIVES } from "../engine/constants.js";
import { createMatchState, stepSimulation, queuePlayerDirection, isMatchOver, resetRound } from "../engine/engine.js";
import { chooseAiDirection } from "../engine/ai.js";
import { createMatch, getMatch } from "../engine/matchStore.js";

const router = express.Router();

router.post("/create", (req, res) => {
  const matchId = Date.now().toString();

  const state = createMatchState(req.body.previousMatchesWon);

  state.mode = "ai";
  state.status = "playing";

  createMatch(matchId, state);

  res.json({ matchId, state });
});

router.post("/:matchId/move", (req, res) => {
  const { playerId, direction } = req.body;
  const { matchId } = req.params;

  const state = getMatch(matchId);
  if (!state)
    return res.status(404).json({ error: "Match not found" });

  if (state.mode !== "ai")
    return res.status(400).json({ error: "Not an AI match" });

  if (direction && typeof playerId === "number") {
    queuePlayerDirection(state, playerId, direction);
  }

  const aiPlayer = state.players.find(p => p.isAi && p.alive);
  if (aiPlayer) {
    const aiDir = chooseAiDirection(state, aiPlayer);
    queuePlayerDirection(state, aiPlayer.id, aiDir);
  }

  stepSimulation(state);

  res.json({
    state,
    matchOver: state.matchOver,
    winner: state.winner
  });
});

router.post("/:matchId/reset-round", (req, res) => {
  const { matchId } = req.params;
  const state = getMatch(matchId);

  if (!state)
    return res.status(404).json({ error: "Match not found" });

  if (isMatchOver(state))
    return res.status(400).json({ error: "Match finished" });

  resetRound(state);

  res.json({ state });
});

router.get("/config", (req, res) => {
  res.json({
    gridWidth: GRID_WIDTH,
    gridHeight: GRID_HEIGHT,
    cellSize: CELL_SIZE,
    playerColors: PLAYER_COLORS,
    tickMs: TICK_MS,
    startingLives: STARTING_LIVES,
    playerKeymap: {
      w: "UP",
      a: "LEFT",
      s: "DOWN",
      d: "RIGHT",
      ArrowUp: "UP",
      ArrowLeft: "LEFT",
      ArrowDown: "DOWN",
      ArrowRight: "RIGHT",
    },
  });
});

export default router;
