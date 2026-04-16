import { GRID_WIDTH, GRID_HEIGHT, CELL_SIZE, PLAYER_COLORS, TICK_MS, STARTING_LIVES } from "./constants.js";
import { DIRECTIONS, DIRECTION_VECTORS, OPPOSITE_DIRECTION } from "./constants.js";

function toIndex(x, y) { return y * GRID_WIDTH + x; }

function makePlayer(id, name, x, y, dir, isAi = false) {
  return { 
    id, 
    name,
    avatar: null,
    isAi, 
    x, 
    y, 
    dir, 
    pendingDir: null, 
    alive: true, 
    lives: STARTING_LIVES,
    connected: false
  };
}

export function createMatchState(previousMatchesWon = [0, 0]) {
  const state = {
    board: new Uint8Array(GRID_WIDTH * GRID_HEIGHT),
    tick: 0,
    roundNumber: 1,
    players: [
      makePlayer(1, "Player", 20, Math.floor(GRID_HEIGHT / 2), DIRECTIONS.RIGHT),
      makePlayer(2, "AI", GRID_WIDTH - 21, Math.floor(GRID_HEIGHT / 2), DIRECTIONS.LEFT, true),
    ],
    roundOver: false,
    matchOver: false,
    winner: null,
    matchesWon: [...previousMatchesWon],
    status: "waiting",
    mode: null,
    _resetScheduled: false
  };

  state.players.forEach(p => state.board[toIndex(p.x, p.y)] = p.id);
  return state;
}

export function resetRound(state) {
  if (state.matchOver) 
    return state;

  state.board.fill(0);
  state.tick = 0;
  state.roundOver = false;
  state.roundNumber += 1;
  state._resetScheduled = false;

  state.players.forEach(p => {
    p.x = p.id === 1 ? 20 : GRID_WIDTH - 21;
    p.y = Math.floor(GRID_HEIGHT / 2);
    p.dir = p.id === 1 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT;
    p.pendingDir = null;
    p.alive = true;
    state.board[toIndex(p.x, p.y)] = p.id;
  });
  return state;
}

export function stepSimulation(state) {
  if (state.roundOver || state.matchOver)
    return state;

  state.tick += 1;
  const alivePlayers = state.players.filter(p => p.alive);
  
  const intents = alivePlayers.map(p => {
    if (p.pendingDir) { 
      p.dir = p.pendingDir; 
      p.pendingDir = null; 
    }
    const vec = DIRECTION_VECTORS[p.dir];
    return { p, nx: p.x + vec.x, ny: p.y + vec.y };
  });

  const collisions = new Set();

  intents.forEach(i => {
    if (i.nx < 0 || i.ny < 0 || i.nx >= GRID_WIDTH || i.ny >= GRID_HEIGHT) {
      collisions.add(i.p.id);
    } else {
      const index = toIndex(i.nx, i.ny);
      if (state.board[index] !== 0) {
        collisions.add(i.p.id);
      }
    }
  });

  if (intents.length === 2 && intents[0].nx === intents[1].nx && intents[0].ny === intents[1].ny) {
    collisions.add(intents[0].p.id);
    collisions.add(intents[1].p.id);
  }

  intents.forEach(i => {
    if (collisions.has(i.p.id)) {
      i.p.alive = false;
    } else {
      i.p.x = i.nx; 
      i.p.y = i.ny;
      state.board[toIndex(i.nx, i.ny)] = i.p.id;
    }
  });

  const stillAlive = state.players.filter(p => p.alive);
  if (stillAlive.length <= 1) {
    state.roundOver = true;
    
    if (stillAlive.length === 1) {
      const loser = state.players.find(p => p.id !== stillAlive[0].id);
      if (loser) loser.lives--;
    } else {
      state.players.forEach(p => p.lives--);
    }

    const deadPlayer = state.players.find(p => p.lives <= 0);
    if (deadPlayer) {
      state.matchOver = true;
      const winner = state.players.find(p => p.lives > 0);
      if (winner) {
        state.winner = winner;
        state.matchesWon[winner.id - 1]++;
      }
      
    }
  }

  return state;
}

export function queuePlayerDirection(state, playerId, direction) {
  const player = state.players.find(p => p.id === playerId);
  if (!player || !player.alive)
    return;

  // Prevent 180-degree turns
  const opposite = OPPOSITE_DIRECTION[player.dir];
  if (direction !== opposite) {
    player.pendingDir = direction;
  }
}

export function isMatchOver(state) {
  return state.matchOver;
}
