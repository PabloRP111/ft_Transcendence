import { createContext, useContext, useEffect, useState } from "react";
import { useSocket } from "./SocketContext";
import { apiFetch } from "../api/client";

const PresenceContext = createContext(new Set());

/*
tracks which users are currently online
on connect: fetches the initial list from GET /api/chat/online
in real time: listens to userOnline/userOffline socket events to stay updated

depends on `connected` (boolean state from SocketContext) so effects
re-run when the socket connects — avoiding the stale ref problem
*/
export function PresenceProvider({ children }) {
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const { socketRef, connected } = useSocket();

  // Fetch initial list whenever the socket connects (also handles reconnects)
  useEffect(() => {
    if (!connected) return;
    apiFetch("/chat/online")
      .then((ids) => setOnlineUsers(new Set(ids.map(String))))
      .catch(() => {});
  }, [connected]);

  // Subscribe to real-time presence events — re-runs when socket connects
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !connected) return;

    const onOnline = ({ userId }) =>
      setOnlineUsers((prev) => new Set(prev).add(String(userId)));

    const onOffline = ({ userId }) =>
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(String(userId));
        return next;
      });

    socket.on("userOnline", onOnline);
    socket.on("userOffline", onOffline);

    return () => {
      socket.off("userOnline", onOnline);
      socket.off("userOffline", onOffline);
    };
  }, [socketRef, connected]);

  return (
    <PresenceContext.Provider value={onlineUsers}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  return useContext(PresenceContext);
}
