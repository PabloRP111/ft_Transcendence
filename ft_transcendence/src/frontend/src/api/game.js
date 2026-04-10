import { apiFetch } from "./client";

// VS IA
export function createGameMatch(payload) {
  return apiFetch("/game/create", {
    method: "POST",
    body: JSON.stringify(payload),
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

export function getConfig() {
  return apiFetch(`/game/config`, {
    method: "GET",
  });
}

// PVP
export function createPvpMatch() {
  return apiFetch("/pvp/create", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function joinPvpMatch(matchId) {
  return apiFetch("/pvp/join", {
    method: "POST",
    body: JSON.stringify({ matchId }),
  });
}

export function getPvpMatch(matchId) {
  return apiFetch(`/pvp/${matchId}`, {
    method: "GET",
  });
}

export function findMatch() {
  return apiFetch("/pvp/matchmaking", {
    method: "POST",
  });
}
