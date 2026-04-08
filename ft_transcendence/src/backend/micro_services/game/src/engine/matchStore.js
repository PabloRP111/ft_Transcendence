const matches = {};

export function createMatch(id, state) {
  matches[id] = state;
}

export function getMatch(id) {
  return matches[id];
}

export function getAllMatches() {
  return matches;
}

export function deleteMatch(id) {
  delete matches[id];
}
