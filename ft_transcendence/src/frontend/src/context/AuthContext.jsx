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
  };

  // LOGOUT
  const logoutUser = async () => {
    try {
      await apiLogout();
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      removeStoredToken();
      setAccessToken(null);
    }
  };

  // INIT AUTH: check saved token and do refresh if it´s needed
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = getStoredToken();

      if (!storedToken) {
        try {
          const data = await refresh();
          if (data.accessToken) {
            setStoredToken(data.accessToken);
            setAccessToken(data.accessToken);
          }
        } catch {
          setAccessToken(null);
        } finally {
          setLoading(false);
        }
        return;
      }

      if (!isTokenExpired(storedToken)) {
        setAccessToken(storedToken);
        setLoading(false);
        return;
      }

      try {
        const data = await refresh();
        if (data.accessToken) {
          setStoredToken(data.accessToken);
          setAccessToken(data.accessToken);
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
    };

    window.addEventListener("session-expired", handleSessionExpired);
    return () => window.removeEventListener("session-expired", handleSessionExpired);
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
