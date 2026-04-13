import { useEffect, useRef } from "react";
import { useSocket } from "../context/SocketContext";

/**
 * useChat — Manages conversation-specific logic over the global socket.
 * * Features:
 * - Automatically joins/leaves rooms when activeConversationId changes.
 * - Uses refs to prevent stale closures in event listeners.
 * - Handles reconnections automatically.
 */
export function useChat(
  activeConversationId,
  {
    onNewMessage,
    onMessageFailed,
    onMessageRead,
    onTypingStart,
    onTypingStop,
    onUserOnline,
    onUserOffline,
  } = {}
) {
  const { socketRef } = useSocket();

  // 1. Sync refs to keep callbacks fresh without re-triggering useEffect
  const refs = useRef({});
  refs.current = {
    onNewMessage, onMessageFailed, onMessageRead,
    onTypingStart, onTypingStop, onUserOnline, onUserOffline
  };

  // 2. Register Global Chat Listeners
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const registerListeners = () => {
      // Event listeners use the ref to always call the latest function version
      socket.on("newMessage", (msg) => refs.current.onNewMessage?.(msg));
      socket.on("messageFailed", (err) => refs.current.onMessageFailed?.(err));
      socket.on("messageRead", (data) => refs.current.onMessageRead?.(data));
      socket.on("typingStart", (data) => refs.current.onTypingStart?.(data));
      socket.on("typingStop", (data) => refs.current.onTypingStop?.(data));
      socket.on("userOnline", (data) => refs.current.onUserOnline?.(data));
      socket.on("userOffline", (data) => refs.current.onUserOffline?.(data));
    };

    // If already connected, register immediately; otherwise wait for connect event
    if (socket.connected) registerListeners();
    socket.on("connect", registerListeners);

    return () => {
      socket.off("connect", registerListeners);
      socket.off("newMessage");
      socket.off("messageFailed");
      socket.off("messageRead");
      socket.off("typingStart");
      socket.off("typingStop");
      socket.off("userOnline");
      socket.off("userOffline");
    };
  }, [socketRef]);

  // 3. Handle Room Management (Join/Leave)
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !activeConversationId) return;

    const joinRoom = () => {
      socket.emit("joinConversation", { conversationId: String(activeConversationId) }, (res) => {
        if (res?.ok) {
          console.log(`[socket] room sync: ${activeConversationId}`);
        } else {
          console.error("[socket] join error:", res?.error);
        }
      });
    };

    if (socket.connected) joinRoom();
    socket.on("connect", joinRoom);

    return () => {
      socket.off("connect", joinRoom);
      // We don't explicitly emit 'leaveConversation' here because the server 
      // manages room membership, and switching rooms is handled by the next 'join'.
    };
  }, [activeConversationId, socketRef]);

  return socketRef;
}