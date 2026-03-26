import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, MessageSquare, Users, UserPlus, User, Search } from "lucide-react";
import { getConversations, getMessages } from "../api/chat";
import { useChat } from "../hooks/useChat";
import { useAuth } from "../context/AuthContext.jsx";


/*
 * ChatModule — top-level coordinator for the chat panel
 *
 * Owns all shared state and side-effects; passes data and callbacks
 * down to the four view components (Inbox, Chat, Search, CreateChannel)
 *
 * Views (navigation stack):
 *   "inbox"  — list of conversations (default)
 *   "chat"   — active conversation
 *   "search" — search users/channels
 *   "create" — create new channel
 */
export default function ChatModule() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState("chat"); // 'chat' or 'friends'
  const [searchTerm, setSearchTerm] = useState("");
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  // Set of userIds currently online (populated by userOnline/userOffline events)
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  // Set of userIds currently typing in the active conversation
  const [typingUsers, setTypingUsers] = useState(new Set());
  const scrollRef = useRef(null);
  // Timer ref for the typingStop debounce — cleared on each keystroke
  const typingTimerRef = useRef(null);
  const { accessToken, isAuthenticated, loading } = useAuth();
  console.log("Auth state:", { accessToken, isAuthenticated, loading });

  const socketRef = useChat(activeConversationId, {
    onNewMessage: (msg) => setMessages((prev) => [...prev, msg]),
    onMessageFailed: (err) => console.error("[chat] message failed:", err),

    // Another user started typing in the active conversation
    onTypingStart: ({ userId }) =>
      setTypingUsers((prev) => new Set(prev).add(userId)),

    // Another user stopped typing — remove them from the set
    onTypingStop: ({ userId }) =>
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      }),

    // Server emits these on socket connect/disconnect — no client action needed
    onUserOnline: ({ userId }) => {
      console.log('[chat] userOnline event received:', userId);
      setOnlineUsers((prev) => new Set(prev).add(userId));
    },

    onUserOffline: ({ userId }) => {
      console.log('[chat] userOffline event received:', userId);
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    },
  });

  // Load conversations from the backend on mount
  useEffect(() => {
    if (!loading && isAuthenticated) {
      console.log("Token listo para cargar conversaciones:", accessToken);
      getConversations()
        .then(setConversations)
        .catch((err) => console.error("[chat] failed to load conversations:", err));
    }
  }, [loading, isAuthenticated]);

  // When the user selects a conversation, load its messages and switch to the chat tab
  useEffect(() => {
    if (!activeConversationId)
      return;

    getMessages(activeConversationId)
      .then(setMessages)
      .catch((err) => console.error("[chat] failed to load messages:", err));

    setActiveTab("chat");
  }, [activeConversationId]);

  // Automatically scroll to the latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeTab]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !activeConversationId) return;

    // Stop typing indicator before sending
    clearTimeout(typingTimerRef.current);
    socketRef.current?.emit("typingStop", { conversationId: String(activeConversationId) });

    socketRef.current?.emit("sendMessage", {
      conversationId: String(activeConversationId),
      content: input.trim(),
    });

    setInput("");
  };

  // Called on every keystroke in the message input.
  // Emits typingStart once per "typing session", then schedules typingStop
  // after 2 seconds of inactivity (debounce) to avoid spamming the server.
  const handleTyping = (e) => {
    setInput(e.target.value);
    if (!activeConversationId) return;

    const convId = String(activeConversationId);

    // Emit typingStart only on the first keystroke (timer is not running yet)
    if (!typingTimerRef.current) {
      socketRef.current?.emit("typingStart", { conversationId: convId });
    }

    // Reset the inactivity timer on every keystroke
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
          <MessageSquare size={14} />
          Arena Chat
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
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              ref={scrollRef}
              className="h-full overflow-y-auto p-4 space-y-4 custom-scrollbar"
            >
              <div className="text-[9px] text-cyan-100/30 uppercase tracking-[0.3em] text-center my-4">
                --- Connection Established ---
              </div>
              {messages.map((msg) => (
                <div key={msg.id} className="flex flex-col animate-in fade-in slide-in-from-left-2">
                  <span className="text-[8px] text-cyan-500/60 mb-1 font-bold">USER_{msg.senderId}:</span>
                  <div className="text-xs text-cyan-50 bg-cyan-950/40 p-2 rounded-r-md rounded-bl-md border-l-2 border-cyan-500/50 max-w-[90%]">
                    {msg.content}
                  </div>
                </div>
              ))}

              {/* Typing indicator — only shown when someone else is typing */}
              {typingUsers.size > 0 && (
                <div className="text-[9px] text-cyan-400/60 italic animate-pulse">
                  {[...typingUsers].map((id) => `USER_${id}`).join(", ")} typing...
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="friends-view"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="h-full flex flex-col"
            >
              {/* Friends Search - Requirement IV.1  */}
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
              
              {/* Conversations List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {conversations.length === 0 ? (
                  <div className="text-[10px] text-cyan-100/30 uppercase tracking-[0.2em] text-center mt-8">
                    No conversations yet
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => setActiveConversationId(conv.id)}
                      className={`flex items-center justify-between p-2 border rounded group cursor-pointer transition-all
                        ${activeConversationId === conv.id
                          ? 'border-cyan-500/60 bg-cyan-950/40'
                          : 'border-cyan-500/10 bg-cyan-950/20 hover:border-cyan-500/30'}`}
                    >
                      <div className="flex items-center gap-2">
                        {/* Presence dot — green if any participant is online */}
                        <div className={`w-1.5 h-1.5 rounded-full ${onlineUsers.size > 0 ? 'bg-green-400' : 'bg-gray-600'}`} />
                        <span className="text-[11px] text-cyan-50">
                          {conv.name ?? (conv.type === 'private' ? 'DM' : 'Channel')}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input form - Only visible in Chat Tab */}
      {activeTab === "chat" && (
        <form 
          onSubmit={handleSendMessage} 
          className="p-4 bg-[#0a0f1a] border-t border-cyan-300/10"
        >
          <div className="relative group">
            <input
              type="text"
              value={input}
              onChange={handleTyping}
              className="w-full bg-voidBlack border border-cyan-900/50 rounded-lg p-3 pr-12 text-xs text-cyan-50 placeholder-cyan-700/50 focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-400 outline-none transition-all"
              placeholder="TYPE_MESSAGE..."
            />
            <button 
              type="submit" 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-500 hover:text-cyan-300 group-focus-within:text-cyan-300 transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        </form>
      )}
    </motion.section>
  );
}