const BASE_URL = window.location.origin + "/api";

export async function getCurrentUser(accessToken) {
  const res = await fetch(`${BASE_URL}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }

  return res.json();
}
