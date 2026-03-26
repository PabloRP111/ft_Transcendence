import { useEffect, useRef } from "react";
import { useSocket } from "../context/SocketContext";

export function useChat(
  activeConversationId,
  {
    onNewMessage,
    onMessageFailed,
    onTypingStart,
    onTypingStop,
    onUserOnline,
    onUserOffline,
    
  } = {}
) {
  const socketRef = useSocket();

  // 1. Sincronizar refs (se puede hacer directamente en el cuerpo para estar siempre al día)
  const refs = useRef({});
  refs.current = { 
    onNewMessage, onMessageFailed, onTypingStart, 
    onTypingStop, onUserOnline, onUserOffline 
  };

  // 2. Registrar listeners de eventos de datos
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const register = () => {
      socket.on("newMessage", (msg) => refs.current.onNewMessage?.(msg));
      socket.on("messageFailed", (err) => refs.current.onMessageFailed?.(err));
      socket.on("typingStart", (data) => refs.current.onTypingStart?.(data));
      socket.on("typingStop", (data) => refs.current.onTypingStop?.(data));
      socket.on("userOnline", (data) => refs.current.onUserOnline?.(data));
      socket.on("userOffline", (data) => refs.current.onUserOffline?.(data));
    };

    if (socket.connected) register();
    socket.on("connect", register); // Importante: registrar para reconexiones

    return () => {
      socket.off("connect", register);
      socket.off("newMessage");
      socket.off("messageFailed");
      socket.off("typingStart");
      socket.off("typingStop");
      socket.off("userOnline");
      socket.off("userOffline");
    };
  }, [socketRef]);

  // 3. Join/Leave de la sala (Corregido error de sintaxis)
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !activeConversationId) return;

    const join = () => {
      socket.emit("joinConversation", { conversationId: String(activeConversationId) }, (res) => {
        if (res?.ok) console.log("[socket] joined room:", activeConversationId);
        else console.error("[socket] failed to join room:", res?.error);
      });
    };

    if (socket.connected) join();
    socket.on("connect", join);

    return () => {
      socket.off("connect", join);
    };
  }, [activeConversationId, socketRef]);

  return socketRef;
}
