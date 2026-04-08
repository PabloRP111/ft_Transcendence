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
import {
  GRID_WIDTH,
  GRID_HEIGHT,
  CELL_SIZE,
  PLAYER_COLORS,
  TICK_MS,
  STARTING_LIVES
} from "../engine/constants.js";

const router = express.Router();

const matches = {};

router.post("/create", (req, res) => {
  const matchId = Date.now().toString();
  const previousMatchesWon = req.body.previousMatchesWon;
  matches[matchId] = createMatchState(previousMatchesWon);
  res.json({ matchId, state: matches[matchId] });
});

router.post("/:matchId/move", (req, res) => {
  const { playerId, direction } = req.body;
  const { matchId } = req.params;

  const state = matches[matchId];
  if (!state) 
    return res.status(404).json({ error: "Match not found" });

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

// GET /game/config
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