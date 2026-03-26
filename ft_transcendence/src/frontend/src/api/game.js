import { apiFetch } from "./client";

export function createGameMatch() {
  return apiFetch("/game/create", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function moveGameMatch(matchId, payload) {
  return apiFetch(`/game/${matchId}/move`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function resetRoundGameMatch(matchId) {
  return apiFetch(`/game/${matchId}/reset-round`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
