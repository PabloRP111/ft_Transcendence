const BASE_URL = window.location.origin + "/api/auth";

export async function register({ email, username, password }) {
  const res = await fetch(`${BASE_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username, password }),
  });
  return res.json();
}

export async function login({ email, password }) {
  const res = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include" // esto envía cookies httpOnly automáticamente
  });
  return res.json();
}

export async function refresh() {
  const res = await fetch(`${BASE_URL}/refresh`, {
    method: "POST",
    credentials: "include"
  });
  return res.json();
}

export async function logout() {
  const res = await fetch(`${BASE_URL}/logout`, {
    method: "POST",
    credentials: "include"
  });
  return res.json();
}

export async function me(accessToken) {
  const res = await fetch(window.location.origin + `/api/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return res.json();
}
