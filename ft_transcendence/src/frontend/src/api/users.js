import { apiFetch } from "./client";

export function getCurrentUser() {
  return apiFetch("/me");
}

// Search users by username (partial, case-insensitive)
export function searchUsers(q) {
  return apiFetch(`/users/search?q=${encodeURIComponent(q)}`);
}
