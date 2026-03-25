import { createContext, useContext, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext();

export function SocketProvider({ children }) {
  const { accessToken } = useAuth();
  const socketRef = useRef(null);

  useEffect(() => {
    if (!accessToken) return;
    if (socketRef.current) return;

    const socket = io("https://localhost:8443/chat", {
      transports: ["websocket"],
      auth: { token: accessToken },
    });

    socket.on("force-logout", () => {
      window.dispatchEvent(new Event("session-expired"));
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken]);

  return (
    <SocketContext.Provider value={socketRef}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}