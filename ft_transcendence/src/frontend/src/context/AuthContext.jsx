import { createContext, useContext, useEffect, useState } from "react";
import { refresh, logout as apiLogout } from "../api/auth.js";
import {
  getStoredToken,
  setStoredToken,
  removeStoredToken,
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

  // LOGOUT
  const logoutUser = async () => {
    try {
      await apiLogout();
    } catch (err) {

    } finally {
      removeStoredToken();
      setAccessToken(null);
      localStorage.removeItem("hasRefreshToken");
    }
  };

  // INIT AUTH: check saved token and do refresh if it´s needed
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

  // Listen invalids Sessions
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
