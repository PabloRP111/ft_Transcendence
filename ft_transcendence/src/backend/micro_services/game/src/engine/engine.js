import {
  DIRECTIONS,
  DIRECTION_VECTORS,
  GRID_HEIGHT,
  GRID_WIDTH,
  OPPOSITE_DIRECTION,
  STARTING_LIVES,
} from "./constants.js";

function toIndex(x, y) {
  return y * GRID_WIDTH + x;
}

function makePlayer(id, name, x, y, dir, isAi = false) {
  return {
    id,
    name,
    isAi,
    x,
    y,
    dir,
    pendingDir: null,
    alive: true,
    lives: STARTING_LIVES,
    score: 0,
  };
}

function seedPlayerOnBoard(board, player) {
  board[toIndex(player.x, player.y)] = player.id;
}

export function createMatchState() {
  const board = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);

  const players = [
    makePlayer(1, "Player", 20, Math.floor(GRID_HEIGHT / 2), DIRECTIONS.RIGHT),
    makePlayer(2, "AI", GRID_WIDTH - 21, Math.floor(GRID_HEIGHT / 2), DIRECTIONS.LEFT, true),
  ];

  seedPlayerOnBoard(board, players[0]);
  seedPlayerOnBoard(board, players[1]);

  return {
    board,
    tick: 0,
    players,
    roundOver: false,
    winnerId: null,
    draw: false,
  };
}

export function resetRound(state) {
  state.board.fill(0);
  state.tick = 0;
  state.roundOver = false;
  state.winnerId = null;
  state.draw = false;

  const p1 = state.players[0];
  const p2 = state.players[1];

  p1.x = 20;
  p1.y = Math.floor(GRID_HEIGHT / 2);
  p1.dir = DIRECTIONS.RIGHT;
  p1.pendingDir = null;
  p1.alive = true;

  p2.x = GRID_WIDTH - 21;
  p2.y = Math.floor(GRID_HEIGHT / 2);
  p2.dir = DIRECTIONS.LEFT;
  p2.pendingDir = null;
  p2.alive = true;

  seedPlayerOnBoard(state.board, p1);
  seedPlayerOnBoard(state.board, p2);
}

export function queuePlayerDirection(state, playerId, nextDir) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || !player.alive) {
    return;
  }

  if (nextDir === player.dir || OPPOSITE_DIRECTION[player.dir] === nextDir) {
    return;
  }

  player.pendingDir = nextDir;
}

function applyPendingDirection(player) {
  if (!player.pendingDir) {
    return;
  }

  player.dir = player.pendingDir;
  player.pendingDir = null;
}

function willCollide(board, x, y) {
  if (x < 0 || y < 0 || x >= GRID_WIDTH || y >= GRID_HEIGHT) {
    return true;
  }

  return board[toIndex(x, y)] !== 0;
}

export function stepSimulation(state) {
  if (state.roundOver) {
    return state;
  }

  state.tick += 1;

  const alivePlayers = state.players.filter((p) => p.alive);
  for (const player of alivePlayers) {
    applyPendingDirection(player);
  }

  const intents = alivePlayers.map((player) => {
    const vector = DIRECTION_VECTORS[player.dir];
    return {
      player,
      nextX: player.x + vector.x,
      nextY: player.y + vector.y,
    };
  });

  const collisions = new Set();

  for (const intent of intents) {
    if (willCollide(state.board, intent.nextX, intent.nextY)) {
      collisions.add(intent.player.id);
    }
  }

  if (intents.length === 2) {
    const first = intents[0];
    const second = intents[1];

    if (first.nextX === second.nextX && first.nextY === second.nextY) {
      collisions.add(first.player.id);
      collisions.add(second.player.id);
    }
  }

  for (const intent of intents) {
    if (collisions.has(intent.player.id)) {
      intent.player.alive = false;
      continue;
    }

    intent.player.x = intent.nextX;
    intent.player.y = intent.nextY;
    state.board[toIndex(intent.nextX, intent.nextY)] = intent.player.id;
  }

  const stillAlive = state.players.filter((p) => p.alive);

  if (stillAlive.length <= 1) {
    state.roundOver = true;

    if (stillAlive.length === 1) {
      const winner = stillAlive[0];
      state.winnerId = winner.id;
      winner.score += 1;
      const loser = state.players.find((p) => p.id !== winner.id);
      if (loser) {
        loser.lives = Math.max(0, loser.lives - 1);
      }
    } else {
      state.draw = true;
      state.players.forEach((p) => {
        p.lives = Math.max(0, p.lives - 1);
      });
    }
  }

  return state;
}

export function isMatchOver(state) {
  return state.players.some((p) => p.lives <= 0);
}

export function getMatchWinner(state) {
  const sorted = [...state.players].sort((a, b) => b.lives - a.lives || b.score - a.score);
  if (sorted[0].lives === sorted[1].lives && sorted[0].score === sorted[1].score) {
    return null;
  }

  return sorted[0];
}
