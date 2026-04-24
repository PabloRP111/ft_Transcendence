import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { refresh, logout as apiLogout } from "../api/auth.js";
import {
  getStoredToken,
  setStoredToken,
  removeStoredToken,
  decodeToken,
  isTokenExpired
} from "../utils/auth.js";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // LOGIN
  const loginUser = (token) => {
    setStoredToken(token);
    setAccessToken(token);
    localStorage.setItem("hasRefreshToken", "1");
  };

  // LOGOUT — wrapped in useCallback so SocketContext's effect dep-array doesn't
  // trigger a socket teardown/recreate on every unrelated AuthContext render.
  const logoutUser = useCallback(async () => {
    try {
      await apiLogout();
    } catch (err) {

    } finally {
      removeStoredToken();
      setAccessToken(null);
      localStorage.removeItem("hasRefreshToken");
    }
  }, []);

  // SILENT REFRESH — called proactively before the token expires, and by
  // SocketContext when it receives a "token expired" connect_error.
  // Returns true on success, false if the refresh token is also gone.
  const tryRefresh = useCallback(async () => {
    try {
      const data = await refresh();
      if (data?.accessToken) {
        setStoredToken(data.accessToken);
        setAccessToken(data.accessToken);
        localStorage.setItem("hasRefreshToken", "1");
        return true;
      }
    } catch {}
    // Refresh token is gone or invalid — full logout
    await logoutUser();
    return false;
  }, [logoutUser]);

  // INIT AUTH: check saved token and do refresh if it's needed
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = getStoredToken();
      const hasRefresh = localStorage.getItem("hasRefreshToken");

      if (storedToken && !isTokenExpired(storedToken)) {
        setAccessToken(storedToken);
        setLoading(false);
        return;
      }

      if (!hasRefresh) {
        setAccessToken(null);
        setLoading(false);
        return;
      }

      try {
        const data = await refresh();

        if (data?.accessToken) {
          setStoredToken(data.accessToken);
          setAccessToken(data.accessToken);
        } else {
          removeStoredToken();
          setAccessToken(null);
          localStorage.removeItem("hasRefreshToken");
        }
      } catch {
        removeStoredToken();
        setAccessToken(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // PROACTIVE REFRESH — schedule a silent token refresh ~60 s before expiry.
  // This keeps the access token alive as long as the refresh token is valid,
  // preventing the socket from reconnecting with an expired token and causing
  // an unexpected logout.
  useEffect(() => {
    if (!accessToken) return;

    const payload = decodeToken(accessToken);
    if (!payload?.expMs) return;

    const msUntilExpiry = payload.expMs - Date.now();
    const refreshDelay = msUntilExpiry - 60_000; // 1 min before expiry

    if (refreshDelay <= 0) return; // already too close — let the next action handle it

    const timer = setTimeout(() => {
      tryRefresh();
    }, refreshDelay);

    return () => clearTimeout(timer);
  }, [accessToken, tryRefresh]);

  // Listen for invalid sessions (any 401 from apiFetch)
  useEffect(() => {
    const handleSessionExpired = () => {
      removeStoredToken();
      setAccessToken(null);
      localStorage.removeItem("hasRefreshToken");
    };

    window.addEventListener("session-expired", handleSessionExpired);
    return () => window.removeEventListener("session-expired", handleSessionExpired);
  }, []);

  // Sync logout across tabs: when another tab removes the token, clear state here too
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "accessToken" && e.newValue === null) {
        setAccessToken(null);
        localStorage.removeItem("hasRefreshToken");
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        isAuthenticated: !!accessToken,
        loginUser,
        logoutUser,
        tryRefresh,
        loading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context)
    throw new Error("useAuth must be used within AuthProvider");
  return context;
}
