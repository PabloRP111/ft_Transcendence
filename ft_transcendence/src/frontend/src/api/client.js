import { getStoredToken} from "../utils/auth";

export async function apiFetch(endpoint, options = {}) {
  const token = getStoredToken();

  const res = await fetch(`${window.location.origin}/api/${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    credentials: "include"
  });

  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new Event("session-expired"));
      throw new Error("Unauthorized");
    }

    const text = await res.text();
    throw new Error(text);
  }

  return res.json();
}
