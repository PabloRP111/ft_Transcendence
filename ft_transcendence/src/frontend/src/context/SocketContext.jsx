import { createContext, useContext, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext();

/**
 * SocketProvider — Manages the lifecycle of the WebSocket connection.
 * It connects automatically when an accessToken is available and 
 * disconnects upon logout or session expiration.
 */
export function SocketProvider({ children }) {
  const { accessToken, logoutUser } = useAuth();
  const socketRef = useRef(null);

  useEffect(() => {
    // 1. If no token exists, ensure the socket is disconnected
    if (!accessToken) {
      if (socketRef.current) {
        console.log("[socket] No token found, disconnecting...");
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // 2. Avoid duplicate connections if the socket is already active
    if (socketRef.current?.connected) return;

    // 3. Initialize connection
    // We point to the '/chat' namespace as defined in your chat-service merge
    const socket = io(`${window.location.origin}/chat`, {
      transports: ["websocket"],
      // Pass the token in the handshake as expected by your backend middleware
      auth: { token: accessToken },
      autoConnect: true,
      // Optional: path if your Nginx config redirects /ws to the chat-service
      // path: "/ws" 
    });

    // 4. Handle Security Events
    // "force-logout" is triggered by the Gateway when a new session starts elsewhere
    socket.on("force-logout", () => {
      console.warn("[socket] Force-logout received from server.");
      logoutUser(); 
    });

    // Handle generic expiration (if the backend middleware rejects the token)
    socket.on("connect_error", (err) => {
      if (err.message === "token expired" || err.message === "missing token") {
        console.error("[socket] Auth error:", err.message);
        logoutUser();
      }
    });

    socketRef.current = socket;

    // 5. Cleanup on Unmount or Token Change
    return () => {
      if (socket) {
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, [accessToken, logoutUser]);

  return (
    <SocketContext.Provider value={socketRef}>
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