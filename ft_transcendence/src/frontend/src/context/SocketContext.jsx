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
  const { accessToken, logoutUser } = useAuth();
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
      transports: ["websocket"],
      auth: { token: accessToken },
      autoConnect: true,
    });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("force-logout", () => {
      console.warn("[socket] Force-logout received from server.");
      logoutUser();
    });

    socket.on("connect_error", (err) => {
      if (err.message === "token expired" || err.message === "missing token") {
        console.error("[socket] Auth error:", err.message);
        logoutUser();
      }
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [accessToken, logoutUser]);

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