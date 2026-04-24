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

// Returns true if the user is already a player in any active (non-finished) match.
// Used to block joining a second match while one is still ongoing or paused.
export function isUserInActiveMatch(userId) {
  return Object.values(matches).some(
    (state) =>
      (state.status === "playing" || state.status === "paused" || state.status === "waiting") &&
      state.players.some((p) => p.userId === userId)
  );
}
