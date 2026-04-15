import { apiFetch } from "./client";
import { getStoredToken } from "../utils/auth";

const BASE_URL = window.location.origin + "/api";

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

export function getImgById(id) {
  const token = getStoredToken();
  return fetch(`${BASE_URL}/users/${id}/avatar`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    credentials: "include"
  }).then((res) => {
    if (!res.ok)
      throw new Error("Failed to load avatar");
    return res.blob();
  });
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

export function uploadAvatar(id, file) {
  const token = getStoredToken();
  const formData = new FormData();
  formData.append("avatar", file);

  return fetch(`${BASE_URL}/users/${id}/avatar`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: formData,
    credentials: "include"
  }).then((res) => {
    if (!res.ok)
      throw new Error("Failed to upload avatar");
    return res.json();
  });
}