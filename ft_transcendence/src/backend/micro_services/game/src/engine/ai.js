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

const DX = [1, -1, 0, 0];
const DY = [0, 0, 1, -1];

const AI_PROFILES = {
  rookie: {
    id: "rookie",
    name: "ROOKIE_SPARK",
    weight: 0.5,
    maxNodes: 700,
    dangerPenalty: 1200,
    deadEndPenalty: 3000,
    hallwayPenalty: 350,
    crampedFloor: 100,
    crampedPenaltyStep: 10,
    wallWeight: 3,
    tieWindow: 180,
    upsetChance: 0.7,
    noise: 220,
    phases: {
      separated: { territory: 7, reachable: 0.6, freedom: 55, keepDir: 3 },
      far: { territory: 6, reachable: 0.7, freedom: 48, keepDir: 2 },
      close: { territory: 5, reachable: 0.6, freedom: 42, keepDir: 2 },
    },
  },
  challenger: {
    id: "challenger",
    name: "CHALLENGER_FLUX",
    weight: 0.35,
    maxNodes: 1700,
    dangerPenalty: 1650,
    deadEndPenalty: 3600,
    hallwayPenalty: 430,
    crampedFloor: 120,
    crampedPenaltyStep: 14,
    wallWeight: 4,
    tieWindow: 110,
    upsetChance: 0.32,
    noise: 90,
    phases: {
      separated: { territory: 10, reachable: 1.2, freedom: 75, keepDir: 6 },
      far: { territory: 9, reachable: 1.4, freedom: 68, keepDir: 8 },
      close: { territory: 8, reachable: 1.1, freedom: 60, keepDir: 6 },
    },
  },
  apex: {
    id: "apex",
    name: "APEX_CORE",
    weight: 0.15,
    maxNodes: GRID_SIZE,
    dangerPenalty: 2200,
    deadEndPenalty: 4000,
    hallwayPenalty: 500,
    crampedFloor: 140,
    crampedPenaltyStep: 20,
    wallWeight: 6,
    tieWindow: 0,
    upsetChance: 0,
    noise: 0,
    phases: {
      separated: { territory: 14, reachable: 0, freedom: 110, keepDir: 10 },
      far: { territory: 12, reachable: 2, freedom: 90, keepDir: 12 },
      close: { territory: 11, reachable: 1.5, freedom: 70, keepDir: 8 },
    },
  },
};

const AI_PROFILE_ORDER = ["rookie", "challenger", "apex"];

function toIndex(x, y) {
  return y * GRID_WIDTH + x;
}

function isInside(x, y) {
  return x >= 0 && y >= 0 && x < GRID_WIDTH && y < GRID_HEIGHT;
}

function isSafe(board, x, y) {
  return (
    isInside(x, y) &&
    board[toIndex(x, y)] === 0
  );
}

function countDangerAt(pos, opponent) {
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

  return danger;
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

function fillDistances(board, start, dist, maxNodes) {
  dist.fill(-1);

  if (!isInside(start.x, start.y)) {
    return;
  }

  let head = 0;
  let tail = 0;

  // Seed from the head position even if occupied so enemy reachability is modeled.
  const startIdx = toIndex(start.x, start.y);
  dist[startIdx] = 0;
  queueX[tail] = start.x;
  queueY[tail] = start.y;
  tail++;

  while (head < tail && tail < maxNodes) {
    const x = queueX[head];
    const y = queueY[head];
    head++;

    const base = toIndex(x, y);
    const d = dist[base];

    for (let i = 0; i < 4; i++) {
      const nx = x + DX[i];
      const ny = y + DY[i];
      if (!isInside(nx, ny)) continue;

      const idx = toIndex(nx, ny);
      if (dist[idx] !== -1 || board[idx] !== 0) continue;

      dist[idx] = d + 1;
      queueX[tail] = nx;
      queueY[tail] = ny;
      tail++;
    }
  }
}

function computeTerritory(board, myStart, oppStart, maxNodes) {
  fillDistances(board, myStart, myDist, maxNodes);
  fillDistances(board, oppStart, oppDist, maxNodes);

  let myScore = 0;
  let myReachable = 0;
  let overlapCount = 0;

  for (let i = 0; i < GRID_SIZE; i++) {
    const myD = myDist[i];
    const oppD = oppDist[i];

    if (myD !== -1) {
      myReachable++;
      if (oppD === -1 || myD < oppD) {
        myScore++;
      }
      if (oppD !== -1) {
        overlapCount++;
      }
    }
  }

  return {
    score: myScore,
    myReachable,
    separated: overlapCount === 0,
  };
}

function getProfilePhase(profile, separated, distToOpponent) {
  if (separated) {
    return profile.phases.separated;
  }
  return distToOpponent > 25 ? profile.phases.far : profile.phases.close;
}

function scoreMove(board, player, opponent, dir, profile, distToOpponent) {
  const pos = forward(player, dir);
  if (!isSafe(board, pos.x, pos.y)) {
    return {
      dir,
      score: -Infinity,
      myReachable: -1,
      freedom: -1,
      keepDir: dir === player.dir ? 1 : 0,
    };
  }

  const danger = countDangerAt(pos, opponent);
  const {
    score: territory,
    myReachable,
    separated,
  } = computeTerritory(board, pos, opponent, profile.maxNodes);

  const freedom = countNeighbors(board, pos.x, pos.y);
  const wallDistance = Math.min(
    pos.x,
    pos.y,
    GRID_WIDTH - 1 - pos.x,
    GRID_HEIGHT - 1 - pos.y
  );
  const trapPenalty =
    freedom <= 1
      ? profile.deadEndPenalty
      : freedom === 2
        ? profile.hallwayPenalty
        : 0;
  const crampedPenalty =
    myReachable < profile.crampedFloor
      ? (profile.crampedFloor - myReachable) * profile.crampedPenaltyStep
      : 0;
  const phase = getProfilePhase(profile, separated, distToOpponent);

  let score =
    territory * phase.territory +
    myReachable * phase.reachable +
    freedom * phase.freedom +
    wallDistance * profile.wallWeight -
    danger * profile.dangerPenalty -
    trapPenalty -
    crampedPenalty +
    (dir === player.dir ? phase.keepDir : 0);

  if (profile.noise > 0) {
    score += (Math.random() - 0.5) * profile.noise;
  }

  return {
    dir,
    score,
    myReachable,
    freedom,
    keepDir: dir === player.dir ? 1 : 0,
  };
}

function sortOptions(options) {
  options.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.myReachable !== a.myReachable) return b.myReachable - a.myReachable;
    if (b.freedom !== a.freedom) return b.freedom - a.freedom;
    return b.keepDir - a.keepDir;
  });
}

function pickProfileMove(options, profile) {
  sortOptions(options);

  const best = options[0];
  if (!best || !Number.isFinite(best.score)) {
    return null;
  }

  if (profile.tieWindow <= 0 || profile.upsetChance <= 0) {
    return best;
  }

  const nearTop = options.filter(
    (opt) =>
      Number.isFinite(opt.score) &&
      best.score - opt.score <= profile.tieWindow
  );

  if (nearTop.length > 1 && Math.random() < profile.upsetChance) {
    const missIndex = 1 + Math.floor(Math.random() * (nearTop.length - 1));
    return nearTop[missIndex];
  }

  return best;
}

export function getAiProfile(profileId) {
  return AI_PROFILES[profileId] || AI_PROFILES.apex;
}

export function pickRandomAiProfile() {
  const roll = Math.random();
  let acc = 0;

  for (const profileId of AI_PROFILE_ORDER) {
    const profile = AI_PROFILES[profileId];
    acc += profile.weight;
    if (roll <= acc) {
      return profile;
    }
  }

  return AI_PROFILES.apex;
}

export function pickNextAiProfile(currentProfileId) {
  const currentIndex = AI_PROFILE_ORDER.indexOf(currentProfileId);
  if (currentIndex === -1) {
    return pickRandomAiProfile();
  }

  const nextIndex = (currentIndex + 1) % AI_PROFILE_ORDER.length;
  return AI_PROFILES[AI_PROFILE_ORDER[nextIndex]];
}

export function chooseAiDirection(state, player) {
  const { board, players } = state;
  const opponent = players.find(p => p.id !== player.id && p.alive);
  if (!opponent) return player.dir;

  const profile = getAiProfile(state?.aiProfile);

  const distToOpponent =
    Math.abs(player.x - opponent.x) +
    Math.abs(player.y - opponent.y);

  const dirs = [
    player.dir,
    LEFT_TURN[player.dir],
    RIGHT_TURN[player.dir],
  ];

  const options = [];

  for (const dir of dirs) {
    options.push(
      scoreMove(board, player, opponent, dir, profile, distToOpponent)
    );
  }

  const chosen = pickProfileMove(options, profile);
  if (!chosen) return player.dir;

  return chosen.dir;
}