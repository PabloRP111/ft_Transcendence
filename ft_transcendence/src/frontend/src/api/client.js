import { getStoredToken } from "../utils/auth";

const BASE_URL = window.location.origin + "/api";

/**
 * Global fetch wrapper for the ft_transcendence API.
 * Automatically injects the JWT from local storage and handles
 * 401 Unauthorized errors by notifying the app to re-authenticate.
 */
export async function apiFetch(endpoint, options = {}) {
  const token = getStoredToken();

  // Ensure the endpoint starts with a slash if it's missing
  const url = `${BASE_URL}${endpoint.startsWith("/") ? endpoint : "/" + endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    // Required to send the Refresh Token cookie to the Gateway/Auth service
    credentials: "include"
  });

  if (!res.ok) {
    // If the Gateway or any service returns 401, the access token is invalid/expired
    if (res.status === 401) {
      console.warn("[apiFetch] Session expired or unauthorized. Dispatching event.");
      window.dispatchEvent(new CustomEvent("session-expired"));
      throw new Error("Unauthorized");
    }

    // Attempt to get a descriptive error message from the response body
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(errorText || res.statusText);
  }

  // Basic check to see if the response has content before parsing JSON
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return res.json();
  }
  
  return null;
}