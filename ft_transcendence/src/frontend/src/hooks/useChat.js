import { useEffect } from "react";
import { useSocket } from "../context/SocketContext";

/**
 * useChat — handles only room joining when the active conversation changes.
 * Message/typing listeners live directly in ChatModule (PresenceContext pattern).
 */
export function useChat(activeConversationId) {
  const { socketRef, connected } = useSocket();

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !connected || !activeConversationId) return;

    const joinRoom = () => {
      socket.emit("joinConversation", { conversationId: String(activeConversationId) }, (res) => {
        if (!res?.ok) console.error("[socket] join error:", res?.error);
      });
    };

    if (socket.connected) joinRoom();
    socket.on("connect", joinRoom);

    return () => {
      socket.off("connect", joinRoom);
    };
  }, [activeConversationId, socketRef, connected]);

  return socketRef;
}
