import {
  DIRECTION_VECTORS,
  LEFT_TURN,
  RIGHT_TURN,
  GRID_HEIGHT,
  GRID_WIDTH,
} from "./constants";

function toIndex(x, y) {
  return y * GRID_WIDTH + x;
}

function isSafe(board, x, y) {
  if (x < 0 || y < 0 || x >= GRID_WIDTH || y >= GRID_HEIGHT) {
    return false;
  }

  return board[toIndex(x, y)] === 0;
}

function forwardPosition(player, dir) {
  const vector = DIRECTION_VECTORS[dir];
  return {
    x: player.x + vector.x,
    y: player.y + vector.y,
  };
}

function countFreeCellsAhead(board, player, dir, depth = 4) {
  const vector = DIRECTION_VECTORS[dir];
  let x = player.x;
  let y = player.y;
  let free = 0;

  for (let i = 0; i < depth; i += 1) {
    x += vector.x;
    y += vector.y;

    if (!isSafe(board, x, y)) {
      break;
    }

    free += 1;
  }

  return free;
}

export function chooseAiDirection(state, player) {
  const { board } = state;

  const straight = player.dir;
  const left = LEFT_TURN[player.dir];
  const right = RIGHT_TURN[player.dir];

  const straightPos = forwardPosition(player, straight);
  if (isSafe(board, straightPos.x, straightPos.y)) {
    return straight;
  }

  const leftScore = countFreeCellsAhead(board, player, left);
  const rightScore = countFreeCellsAhead(board, player, right);

  if (leftScore === 0 && rightScore === 0) {
    return straight;
  }

  return leftScore >= rightScore ? left : right;
}
