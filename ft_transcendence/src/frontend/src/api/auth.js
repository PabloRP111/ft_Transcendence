import { apiFetch } from "./client";

const BASE_URL = window.location.origin + "/api";

/**
 * REGISTER (No token required)
 */
export async function register(data) {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const responseData = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: responseData.error || "Registration failed" };
  }
  return responseData;
}

/**
 * LOGIN (No token required, sets HTTP-only cookie)
 */
export async function login(data) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "include" // Important for receiving the Refresh Token cookie
  });

  const responseData = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: responseData.error || "Login failed" };
  }
  return responseData;
}

/**
 * REFRESH (Uses HTTP-only cookie to get a new Access Token)
 */
export async function refresh() {
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include"
  });

  if (!res.ok) {
    // cualquier fallo se trata como "no sesión", NO error
    return null;
  }

  return res.json();
}

// LOGOUT
export async function logout() {
  await fetch(`${BASE_URL}/auth/logout`, {
    method: "POST",
    credentials: "include"
  });
}
