/*
WebSocket connection manager for the chat:
*   - Connects to the /chat namespace with the JWT token on mount
*   - Joins the active conversation room when activeConversationId changes
*   - Exposes the socket instance so the component can emit and listen to events
*   - Disconnects cleanly when the component unmounts

* WebSocket flow:
*   Frontend → Nginx (/socket.io/) → chat-service directly (gateway is bypassed)
*   Auth: JWT passed in the handshake, validated by chat-service

* REST calls (loading history, creating conversations) are in src/api/chat.js.
* This hook is only for real-time communication
*/

import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { getStoredToken } from "../utils/auth";

/*
* useChat(activeConversationId, { onNewMessage, onMessageFailed, onTypingStart, onTypingStop, onUserOnline, onUserOffline })
*
* Manages the Socket.IO connection lifecycle:
*   - Joins the active conversation room when activeConversationId changes
*   - Calls onNewMessage when the server broadcasts a new message to the room
*   - Calls onMessageFailed when the server rejects a sendMessage attempt
*   - Calls onTypingStart/onTypingStop when another user starts/stops typing
*   - Calls onUserOnline/onUserOffline when a user's presence changes
*
* Returns socketRef (the ref object, not .current) so the caller can
* emit events via socketRef.current?.emit(...) at any time.
*
* Callbacks are stored in refs internally so they never need to be
* re-registered on the socket — the latest version is always called.
*/
export function useChat(activeConversationId, {
  onNewMessage,
  onMessageFailed,
  onTypingStart,
  onTypingStop,
  onUserOnline,
  onUserOffline,
} = {}) {
  const socketRef = useRef(null);

  const onNewMessageRef = useRef(onNewMessage);
  const onMessageFailedRef = useRef(onMessageFailed);
  const onTypingStartRef = useRef(onTypingStart);
  const onTypingStopRef = useRef(onTypingStop);
  const onUserOnlineRef = useRef(onUserOnline);
  const onUserOfflineRef = useRef(onUserOffline);
  useEffect(() => { onNewMessageRef.current = onNewMessage; }, [onNewMessage]);
  useEffect(() => { onMessageFailedRef.current = onMessageFailed; }, [onMessageFailed]);
  useEffect(() => { onTypingStartRef.current = onTypingStart; }, [onTypingStart]);
  useEffect(() => { onTypingStopRef.current = onTypingStop; }, [onTypingStop]);
  useEffect(() => { onUserOnlineRef.current = onUserOnline; }, [onUserOnline]);
  useEffect(() => { onUserOfflineRef.current = onUserOffline; }, [onUserOffline]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;

    const socket = io("/chat", {
      auth: { token },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[socket] connected:", socket.id);
    });

    socket.on("connect_error", (err) => {
      console.error("[socket] connection error:", err.message);
    });

    socket.on("disconnect", (reason) => {
      console.log("[socket] disconnected:", reason);
    });

    // 'newMessage' is broadcast by the server to all sockets in the room
    // after the message is persisted to DB.
    socket.on("newMessage", (msg) => {
      onNewMessageRef.current?.(msg);
    });

    // 'messageFailed' is sent only to the originating client on error.
    socket.on("messageFailed", (err) => {
      console.error("[socket] message failed:", err);
      onMessageFailedRef.current?.(err);
    });

    // Typing indicators — rebroadcast by the server to the room excluding the sender.
    // Payload: { conversationId, userId }
    socket.on("typingStart", (data) => {
      onTypingStartRef.current?.(data);
    });

    socket.on("typingStop", (data) => {
      onTypingStopRef.current?.(data);
    });

    // Presence — emitted by the server on connect/disconnect lifecycle.
    // The client never emits these; the server drives them.
    // Payload: { userId }
    socket.on("userOnline", (data) => {
      onUserOnlineRef.current?.(data);
    });

    socket.on("userOffline", (data) => {
      onUserOfflineRef.current?.(data);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !activeConversationId) return;

    socket.emit("joinConversation", { conversationId: String(activeConversationId) }, (res) => {
      if (res?.ok) {
        console.log("[socket] joined room:", activeConversationId);
      } else {
        console.error("[socket] failed to join room:", res?.error);
      }
    });
  }, [activeConversationId]);

  // Return the ref object (not .current) so the caller always reads the
  // live socket value, even between renders.
  return socketRef;
}
