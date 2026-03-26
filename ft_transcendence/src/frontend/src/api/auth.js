const BASE_URL = window.location.origin + "/api";

// REGISTER (sin token)
export async function register(data) {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// LOGIN (sin token)
export async function login(data) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "include"
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// REFRESH (sin token pero con cookie)
export async function refresh() {
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include"
  });

  if (res.status === 401) {
    window.dispatchEvent(new Event("session-expired"));
    throw new Error("Unauthorized");
  }
  return res.json();
}

// LOGOUT (sin token)
export async function logout() {
  return fetch(`${BASE_URL}/auth/logout`, {
    method: "POST",
    credentials: "include"
  });
}
