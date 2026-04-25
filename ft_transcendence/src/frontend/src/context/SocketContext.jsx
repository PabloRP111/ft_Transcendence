import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext();

/**
 * SocketProvider — Manages the lifecycle of the WebSocket connection.
 * Exposes { socketRef, connected } so consumers can react when the socket
 * connects or disconnects (e.g. PresenceContext re-registering listeners).
 */
export function SocketProvider({ children }) {
  const { accessToken, logoutUser, tryRefresh } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
      return;
    }

    if (socketRef.current?.connected) return;

    const socket = io(`${window.location.origin}/chat`, {
      path: "/socket.io/chat",
      transports: ["websocket", "polling"],
      auth: { token: accessToken },
      autoConnect: true,
    });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("force-logout", () => {
      logoutUser();
    });

    socket.on("connect_error", (err) => {
      if (err.message === "token expired") {
        // The access token expired while the socket was reconnecting.
        // Stop retrying with the stale token, then attempt a silent refresh.
        // If the refresh succeeds, accessToken state changes and this effect
        // re-runs, creating a new socket with the fresh token.
        // If the refresh fails (refresh token also gone), tryRefresh calls logoutUser.
        socket.disconnect();
        tryRefresh();
        return;
      }
      if (err.message === "missing token") {
        logoutUser();
      }
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [accessToken, logoutUser, tryRefresh]);

  return (
    <SocketContext.Provider value={{ socketRef, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}
