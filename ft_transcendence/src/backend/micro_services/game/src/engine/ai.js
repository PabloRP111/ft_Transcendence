import {
  DIRECTION_VECTORS,
  LEFT_TURN,
  RIGHT_TURN,
  GRID_HEIGHT,
  GRID_WIDTH,
} from "./constants.js";

const GRID_SIZE = GRID_WIDTH * GRID_HEIGHT;

const myDist = new Int16Array(GRID_SIZE);
const oppDist = new Int16Array(GRID_SIZE);

const queueX = new Int16Array(GRID_SIZE);
const queueY = new Int16Array(GRID_SIZE);

function toIndex(x, y) {
  return y * GRID_WIDTH + x;
}

function isSafe(board, x, y) {
  return (
    x >= 0 &&
    y >= 0 &&
    x < GRID_WIDTH &&
    y < GRID_HEIGHT &&
    board[toIndex(x, y)] === 0
  );
}

function forward(player, dir) {
  const v = DIRECTION_VECTORS[dir];
  return { x: player.x + v.x, y: player.y + v.y };
}

function countNeighbors(board, x, y) {
  let c = 0;
  if (isSafe(board, x + 1, y)) c++;
  if (isSafe(board, x - 1, y)) c++;
  if (isSafe(board, x, y + 1)) c++;
  if (isSafe(board, x, y - 1)) c++;
  return c;
}

function computeTerritory(board, myStart, oppStart, maxDepth) {
  myDist.fill(-1);
  oppDist.fill(-1);

  let head = 0, tail = 0;

  if (isSafe(board, myStart.x, myStart.y)) {
    const idx = toIndex(myStart.x, myStart.y);
    myDist[idx] = 0;
    queueX[tail] = myStart.x;
    queueY[tail] = myStart.y;
    tail++;
  }

  const dx = [1, -1, 0, 0];
  const dy = [0, 0, 1, -1];

  while (head < tail && tail < maxDepth) {
    const x = queueX[head];
    const y = queueY[head];
    head++;

    const base = toIndex(x, y);
    const d = myDist[base];

    for (let i = 0; i < 4; i++) {
      const nx = x + dx[i];
      const ny = y + dy[i];
      if (!isSafe(board, nx, ny)) continue;

      const idx = toIndex(nx, ny);
      if (myDist[idx] === -1) {
        myDist[idx] = d + 1;
        queueX[tail] = nx;
        queueY[tail] = ny;
        tail++;
      }
    }
  }

  head = 0; tail = 0;

  if (isSafe(board, oppStart.x, oppStart.y)) {
    const idx = toIndex(oppStart.x, oppStart.y);
    oppDist[idx] = 0;
    queueX[tail] = oppStart.x;
    queueY[tail] = oppStart.y;
    tail++;
  }

  while (head < tail && tail < maxDepth) {
    const x = queueX[head];
    const y = queueY[head];
    head++;

    const base = toIndex(x, y);
    const d = oppDist[base];

    for (let i = 0; i < 4; i++) {
      const nx = x + dx[i];
      const ny = y + dy[i];
      if (!isSafe(board, nx, ny)) continue;

      const idx = toIndex(nx, ny);
      if (oppDist[idx] === -1) {
        oppDist[idx] = d + 1;
        queueX[tail] = nx;
        queueY[tail] = ny;
        tail++;
      }
    }
  }

  let myScore = 0;
  let oppReachable = false;

  for (let i = 0; i < GRID_SIZE; i++) {
    if (myDist[i] !== -1) {
      if (oppDist[i] === -1) {
        myScore++;
      } else {
        oppReachable = true;
        if (myDist[i] < oppDist[i]) myScore++;
      }
    }
  }

  return {
    score: myScore,
    separated: !oppReachable
  };
}

export function chooseAiDirection(state, player) {
  const { board, players } = state;
  const opponent = players.find(p => p.id !== player.id && p.alive);
  if (!opponent) return player.dir;

  const distToOpponent =
    Math.abs(player.x - opponent.x) +
    Math.abs(player.y - opponent.y);

  const maxDepth =
    distToOpponent > 25 ? 2000 : 400;

  const dirs = [
    player.dir,
    LEFT_TURN[player.dir],
    RIGHT_TURN[player.dir],
  ];

  const options = [];

  for (const dir of dirs) {
    const pos = forward(player, dir);

    if (!isSafe(board, pos.x, pos.y)) {
      options.push({ dir, score: -Infinity });
      continue;
    }

    let danger = 0;
    const oppDirs = [
      opponent.dir,
      LEFT_TURN[opponent.dir],
      RIGHT_TURN[opponent.dir],
    ];

    for (const odir of oppDirs) {
      const v = DIRECTION_VECTORS[odir];
      if (pos.x === opponent.x + v.x && pos.y === opponent.y + v.y) {
        danger++;
      }
    }
    const { score: territory, separated } =
      computeTerritory(board, pos, opponent, maxDepth);

    const freedom = countNeighbors(board, pos.x, pos.y);

    let score;

    if (separated) {
      score =
        territory * 12 +
        freedom * 2;
    } else if (distToOpponent > 25) {
      score =
        territory * 11 +
        freedom * 2 +
        (dir === player.dir ? 5 : 0);
    } else {
      score =
        territory * 10 +
        freedom * 1.5 -
        danger * 2000 +
        (dir === player.dir ? 3 : 0);
    }

    options.push({ dir, score });
  }

  options.sort((a, b) => b.score - a.score);

  if (
    options.length > 1 &&
    Math.abs(options[0].score - options[1].score) < 10
  ) {
    return Math.random() < 0.5 ? options[0].dir : options[1].dir;
  }

  return options[0].dir;
}