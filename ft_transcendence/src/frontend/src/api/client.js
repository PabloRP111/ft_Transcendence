import { getStoredToken } from "../utils/auth";

const BASE_URL = window.location.origin + "/api";

export async function apiFetch(endpoint, options = {}) {
  const token = getStoredToken();

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    credentials: "include"
  });

  if (!res.ok) {
    if (res.status === 401) // notificar al contexto global que la sesión expiró
      window.dispatchEvent(new CustomEvent("session-expired"));

    const text = await res.text();
    throw new Error(text);
  }

  return res.json();
}
