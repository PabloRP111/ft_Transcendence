import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, MessageSquare, Users, Search } from "lucide-react";
import { getConversations, getMessages, createConversation } from "../api/chat";
import { useChat } from "../hooks/useChat";

// Helper to get my ID from the token without needing a external hook
const getMyIdFromToken = () => {
  const token = localStorage.getItem("accessToken"); 
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(window.atob(base64));
    return payload.id; 
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
      {/* Header section with Dynamic Tabs */}
      <div className="p-4 border-b border-cyan-300/20 bg-cyan-950/10 flex justify-between items-center">
        <button 
          onClick={() => setActiveTab("chat")} 
          className={`text-[10px] uppercase tracking-[0.2em] flex items-center gap-2 transition-colors ${activeTab === 'chat' ? 'text-cyan-400' : 'text-cyan-100/40 hover:text-cyan-200'}`}
        >
          <MessageSquare size={14} /> Arena Chat
        </button>
        <button 
          onClick={() => setActiveTab("friends")} 
          className={`transition-colors ${activeTab === 'friends' ? 'text-cyan-400' : 'text-cyan-100/40 hover:text-cyan-200'}`}
        >
          <Users size={16} />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {activeTab === "chat" ? (
            <motion.div 
              key="chat-view" 
              ref={scrollRef} 
              className="h-full overflow-y-auto p-4 space-y-4 custom-scrollbar"
            >
              <div className="text-[9px] text-cyan-100/30 uppercase tracking-[0.3em] text-center my-4">--- Connection Established ---</div>

              {messages.map((msg) => {
                const isMe = String(msg.senderId) === String(myId);
                const time = msg.createdAt 
                  ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : "";

                return (
                  <div 
                    key={msg.id} 
                    className={`flex flex-col animate-in fade-in slide-in-from-left-2 ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <span className={`text-[8px] mb-1 font-bold ${isMe ? 'text-cyan-300' : 'text-cyan-500/60'}`}>
                      {isMe ? "YOU" : (msg.sender?.username || msg.senderUsername || `USER_${msg.senderId}`)}:
                    </span>
                    <div className={`text-xs p-2 rounded-md font-mono max-w-[90%] ${
                      isMe 
                        ? 'bg-cyan-500/20 border-r-2 border-cyan-400 text-cyan-100' 
                        : 'bg-cyan-950/40 border-l-2 border-cyan-500/50 text-cyan-50'
                    }`}>
                      {msg.content}
                    </div>
                    {/* Timestamp display */}
                    <span className="text-[7px] text-cyan-100/20 mt-1 px-1 font-mono">
                      {time}
                    </span>
                  </div>
                );
              })}

              {typingUsers.size > 0 && <div className="text-[9px] text-cyan-400/60 italic animate-pulse">Someone is typing...</div>}
            </motion.div>
          ) : (
            <motion.div key="friends-view" className="h-full flex flex-col">
              <div className="p-3 border-b border-cyan-300/10">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-cyan-500/40" size={12} />
                  <input 
                    type="text" 
                    placeholder="Search entities..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className="w-full bg-voidBlack/50 border border-cyan-500/20 rounded-md py-1.5 pl-7 pr-3 text-[10px] text-cyan-50 focus:outline-none focus:border-cyan-400/50" 
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {conversations.map((conv) => (
                  <div 
                    key={conv.id} 
                    onClick={() => setActiveConversationId(conv.id)} 
                    className={`flex items-center justify-between p-2 border rounded group cursor-pointer transition-all ${activeConversationId === conv.id ? 'border-cyan-500/60 bg-cyan-950/40' : 'border-cyan-500/10 bg-cyan-950/20 hover:border-cyan-500/30'}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${onlineUsers.size > 0 ? 'bg-green-400' : 'bg-gray-600'}`} />
                      <span className="text-[11px] text-cyan-50 font-mono">{conv.name || (conv.type === 'private' ? 'Direct_Link' : 'Public_Channel')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {activeTab === "chat" && (
        <form onSubmit={handleSendMessage} className="p-4 bg-[#0a0f1a] border-t border-cyan-300/10">
          <div className="relative group">
            <input 
              type="text" 
              value={input} 
              onChange={handleTyping} 
              className="w-full bg-voidBlack border border-cyan-900/50 rounded-lg p-3 pr-12 text-xs text-cyan-50 placeholder-cyan-700/50 focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-400 outline-none transition-all font-mono" 
              placeholder={activeConversationId ? "TYPE_MESSAGE..." : "SELECT_CHANNEL..."} 
            />
            <button 
              type="submit" 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-500 hover:text-cyan-300 disabled:text-cyan-900" 
              disabled={!activeConversationId}
            >
              <Send size={18} />
            </button>
          </div>
        </form>
      )}
    </motion.section>
  );
}