import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, MessageSquare, Users, Search } from "lucide-react";
import { getConversations, getMessages, createConversation } from "../api/chat";
import { useChat } from "../hooks/useChat";

// Helper to get my ID from the token without needing a hook [English Comment]
const getMyIdFromToken = () => {
  const token = localStorage.getItem("accessToken"); // Verify if your key is 'token' or 'accessToken'
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(window.atob(base64));
    return payload.id; // Returns the numeric ID
  } catch (e) {
    return null;
  }
};

export default function ChatModule() {
  const myId = getMyIdFromToken();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState("chat");
  const [searchTerm, setSearchTerm] = useState("");
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState(new Set());
  const scrollRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isInitializing = useRef(false);

  const socketRef = useChat(activeConversationId, {
    onNewMessage: (msg) => setMessages((prev) => [...prev, msg]),
    onMessageFailed: (err) => console.error("[chat] message failed:", err),
    onTypingStart: ({ userId }) => setTypingUsers((prev) => new Set(prev).add(userId)),
    onTypingStop: ({ userId }) => setTypingUsers((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    }),
    onUserOnline: ({ userId }) => setOnlineUsers((prev) => new Set(prev).add(userId)),
    onUserOffline: ({ userId }) => setOnlineUsers((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    }),
  });

  useEffect(() => {
    async function initializeChat() {
      if (isInitializing.current) return;
      isInitializing.current = true;
      try {
        let convs = await getConversations();
        let arena = convs.find(c => c.type === "channel");
        if (!arena) {
          arena = await createConversation("channel", [], "Arena_General");
          convs = await getConversations();
        }
        setConversations(convs);
        if (arena) setActiveConversationId(arena.id);
      } catch (err) {
        console.error("[chat] failed to load conversations:", err);
      }
    }
    initializeChat();
  }, []);

  useEffect(() => {
    if (!activeConversationId) return;
    getMessages(activeConversationId).then(setMessages).catch(console.error);
    setActiveTab("chat");
  }, [activeConversationId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, activeTab]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !activeConversationId) return;
    clearTimeout(typingTimerRef.current);
    socketRef.current?.emit("typingStop", { conversationId: String(activeConversationId) });
    socketRef.current?.emit("sendMessage", {
      conversationId: String(activeConversationId),
      content: input.trim(),
    });
    setInput("");
  };

  const handleTyping = (e) => {
    setInput(e.target.value);
    if (!activeConversationId) return;
    const convId = String(activeConversationId);
    if (!typingTimerRef.current) socketRef.current?.emit("typingStart", { conversationId: convId });
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socketRef.current?.emit("typingStop", { conversationId: convId });
      typingTimerRef.current = null;
    }, 2000);
  };

  return (
    <motion.section 
      className="neon-panel flex flex-col h-full bg-[#05070d]/90 backdrop-blur-md overflow-hidden rounded-xl border border-cyan-500/30"
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
    >
      <div className="p-4 border-b border-cyan-300/20 bg-cyan-950/10 flex justify-between items-center">
        <button onClick={() => setActiveTab("chat")} className={`text-[10px] uppercase tracking-[0.2em] flex items-center gap-2 ${activeTab === 'chat' ? 'text-cyan-400' : 'text-cyan-100/40'}`}>
          <MessageSquare size={14} /> Arena Chat
        </button>
        <button onClick={() => setActiveTab("friends")} className={activeTab === 'friends' ? 'text-cyan-400' : 'text-cyan-100/40'}>
          <Users size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {activeTab === "chat" ? (
            <motion.div key="chat-view" ref={scrollRef} className="h-full overflow-y-auto p-4 space-y-4 custom-scrollbar">
              <div className="text-[9px] text-cyan-100/30 uppercase tracking-[0.3em] text-center my-4">--- Connection Established ---</div>

              {messages.map((msg) => {
                const isMe = String(msg.senderId) === String(myId);
                return (
                  <div key={msg.id} className={`flex flex-col animate-in fade-in slide-in-from-left-2 ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className={`text-[8px] mb-1 font-bold ${isMe ? 'text-cyan-300' : 'text-cyan-500/60'}`}>
                      {isMe ? "YOU" : (msg.sender?.username || msg.senderUsername || `USER_${msg.senderId}`)}:
                    </span>
                    <div className={`text-xs p-2 rounded-md font-mono max-w-[90%] ${
                      isMe ? 'bg-cyan-500/20 border-r-2 border-cyan-400 text-cyan-100' : 'bg-cyan-950/40 border-l-2 border-cyan-500/50 text-cyan-50'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                );
              })}

              {typingUsers.size > 0 && <div className="text-[9px] text-cyan-400/60 italic animate-pulse">Someone is typing...</div>}
            </motion.div>
          ) : (
            <motion.div key="friends-view" className="h-full flex flex-col">
              {/* Friends list view... (omitted for brevity) */}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {activeTab === "chat" && (
        <form onSubmit={handleSendMessage} className="p-4 bg-[#0a0f1a] border-t border-cyan-300/10">
          <div className="relative group">
            <input type="text" value={input} onChange={handleTyping} className="w-full bg-voidBlack border border-cyan-900/50 rounded-lg p-3 pr-12 text-xs text-cyan-50 focus:outline-none transition-all font-mono" placeholder="TYPE_MESSAGE..." />
            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-500" disabled={!activeConversationId}><Send size={18} /></button>
          </div>
        </form>
      )}
    </motion.section>
  );
}