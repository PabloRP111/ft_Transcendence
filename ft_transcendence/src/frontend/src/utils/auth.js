export function getStoredToken() {
  return localStorage.getItem("accessToken");
}

export function setStoredToken(token) {
  localStorage.setItem("accessToken", token);
}

export function removeStoredToken() {
  localStorage.removeItem("accessToken");
}

// Decodificar payload sin verificar firma (solo frontend)
export function decodeToken(token) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export function isTokenExpired(token) {
  const payload = decodeToken(token);
  if (!payload?.expMs)
    return true;
  return Date.now() > payload.expMs;
}