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

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: "Registration failed" }));
    throw new Error(errorData.error || "Registration failed");
  }
  return res.json();
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

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: "Login failed" }));
    throw new Error(errorData.error || "Login failed");
  }
  return res.json();
}

/**
 * REFRESH (Uses HTTP-only cookie to get a new Access Token)
 */
export async function refresh() {
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include"
  });

  // If the refresh fails (expired or missing cookie), notify the app to redirect to login
  if (res.status === 401) {
    window.dispatchEvent(new Event("session-expired"));
    throw new Error("Session expired");
  }

  if (!res.ok) throw new Error("Could not refresh session");
  
  return res.json();
}

/**
 * LOGOUT (Clears session and cookies)
 */
export async function logout() {
  // Using the apiFetch helper to maintain consistency with the rest of the protected API
  return apiFetch("/auth/logout", { method: "POST" });
}