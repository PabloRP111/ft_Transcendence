import { apiFetch } from "./client";

export function getCurrentUser() {
  return apiFetch("/me");
}

// Search users by username (partial, case-insensitive)
export function searchUsers(q) {
  return apiFetch(`/users/search?q=${encodeURIComponent(q)}`);
}

export function getUserById(id) {
  return apiFetch(`/users/${id}`);
}

export function getUserByUsername(username) {
  return apiFetch(`/users/by-username/${encodeURIComponent(username)}`);
}

export function editUser(_accessToken, userData) {
  return apiFetch("/me", {
    method: "PUT",
    body: JSON.stringify(userData),
  });
}