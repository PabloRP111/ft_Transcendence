import fetch from "node-fetch";

const USERS_SERVICE = process.env.USERS_SERVICE || "http://users:3002";

export async function loginUser(email, password) {
  const response = await fetch(`${USERS_SERVICE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok)
    return null;

  return await response.json();
}

export async function registerUser(email, username, password) {
  const response = await fetch(`${USERS_SERVICE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username, password }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("Users service error:", data);
    throw new Error(data?.error || "Users service failed");
  }

  return data;
}
