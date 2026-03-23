import { createContext, useContext, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext();

export function SocketProvider({ children }) {
  const { accessToken, logoutUser } = useAuth();
  const socketRef = useRef(null);

  useEffect(() => {
    // Si no hay token → no hay socket
    if (!accessToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // Crear socket
    const socket = io(window.location.origin, {
      path: "/ws", // opcional si usas nginx
      autoConnect: false,
      transports: ["websocket"]
    });

    socket.connect();

    // Autenticación
    socket.emit("auth", accessToken);

    // 🔥 Evento importante
    socket.on("force-logout", () => {
      logoutUser();
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [accessToken]);

  return (
    <SocketContext.Provider value={socketRef.current}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}