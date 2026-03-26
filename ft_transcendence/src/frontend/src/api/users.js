import { apiFetch } from "./client";

export function getCurrentUser() {
  return apiFetch("/me");
}

// Search users by username (partial, case-insensitive)
export function searchUsers(q) {
  return apiFetch(`/users/search?q=${encodeURIComponent(q)}`);
}

export async function editUser(accessToken, userData) {
  const res = await fetch(`/me`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(userData),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }

  return res.json();
}