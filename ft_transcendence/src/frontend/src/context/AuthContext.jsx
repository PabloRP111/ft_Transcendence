import { createContext, useContext, useState, useEffect } from "react";
import { refresh } from "../api/auth.js";

const AuthContext = createContext();

export function AuthProvider({ children }) {

  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const loginUser = (token) => {
    setAccessToken(token);
  };

  const logoutUser = () => {
    setAccessToken(null);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const data = await refresh();

        if (data.accessToken)
          setAccessToken(data.accessToken);

      } catch {
        setAccessToken(null);
      }

      setLoading(false);
    };

    initAuth();
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