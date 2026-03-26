import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// API & Hooks
import { getConversations, getMessages, createConversation, searchChannels, joinChannel } from "../api/chat";
import { searchUsers } from "../api/users";
import { useChat } from "../hooks/useChat";
import { useAuth } from "../context/AuthContext.jsx";

// Utilities & Views
import { getMyIdFromToken, getLastOpened, saveLastOpened } from "../utils/chatStorage";
import InboxView from "./chat/InboxView";
import ChatView from "./chat/ChatView";
import SearchView from "./chat/SearchView";
import CreateChannelView from "./chat/CreateChannelView";

/**
 * ChatModule — Top-level coordinator for the chat panel.
 * Manages the navigation stack, socket events, and shared state.
 */
export default function ChatModule() {
  const { loading, isAuthenticated } = useAuth();
  const myId = getMyIdFromToken();

  // ── Navigation State ──────────────────────────────────────────────────────
  const [view, setView] = useState("inbox"); // inbox, chat, search, create

  // ── Conversations & Messages ──────────────────────────────────────────────
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  // ── Presence, Typing & Unreads ────────────────────────────────────────────
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [unreadIds, setUnreadIds] = useState(new Set());

  // ── Search & Channel Creation ─────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState({ users: [], channels: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const searchTimerRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isInitializing = useRef(false);

  // ── WebSocket Logic ───────────────────────────────────────────────────────
  const socketRef = useChat(activeConversationId, {
    onNewMessage: (msg) => {
      // Re-sort inbox based on latest message
      setConversations((prev) => prev.map((c) =>
        String(c.id) === String(msg.conversationId)
          ? { ...c, lastMessageAt: msg.createdAt }
          : c
      ));

      // Append if active, otherwise mark as unread
      if (String(msg.conversationId) === String(activeConversationId)) {
        setMessages((prev) => [...prev, msg]);
      } else {
        setUnreadIds((prev) => new Set(prev).add(msg.conversationId));
      }
    },
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

  // ── Initialization (Mount) ────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !isAuthenticated || isInitializing.current) return;
    
    async function initializeChat() {
      isInitializing.current = true;
      try {
        let convs = await getConversations();
        
        // Ensure default global channel exists
        if (!convs.some(c => c.name === "Arena_General")) {
          await createConversation("channel", [], "Arena_General");
          convs = await getConversations();
        }
        setConversations(convs);

        // Calculate unread badges from local storage
        const offlineUnread = new Set();
        convs.forEach((conv) => {
          if (!conv.lastMessageAt) return;
          const lastOpened = getLastOpened(myId, conv.id);
          if (!lastOpened || new Date(conv.lastMessageAt) > lastOpened) {
            offlineUnread.add(conv.id);
          }
        });
        setUnreadIds(offlineUnread);
      } catch (err) {
        console.error("[chat] initialization failed:", err);
      }
    }
    initializeChat();
  }, [loading, isAuthenticated]);

  // ── Load History ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeConversationId) return;
    getMessages(activeConversationId).then(setMessages).catch(console.error);
  }, [activeConversationId]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openConversation = (convId) => {
    setActiveConversationId(convId);
    setView("chat");
    saveLastOpened(myId, convId);
    setUnreadIds((prev) => {
      const next = new Set(prev);
      next.delete(convId);
      next.delete(String(convId));
      return next;
    });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !activeConversationId) return;

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

    if (!typingTimerRef.current) {
      socketRef.current?.emit("typingStart", { conversationId: String(activeConversationId) });
    }

    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socketRef.current?.emit("typingStop", { conversationId: String(activeConversationId) });
      typingTimerRef.current = null;
    }, 2000);
  };

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchTerm(q);
    clearTimeout(searchTimerRef.current);

    if (!q.trim()) {
      setSearchResults({ users: [], channels: [] });
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const [users, channels] = await Promise.all([
          searchUsers(q).catch(() => []),
          searchChannels(q).catch(() => []),
        ]);
        setSearchResults({ users, channels });
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const activeConversation = conversations.find(c => c.id === activeConversationId);

  return (
    <motion.section
      className="neon-panel flex flex-col h-full bg-[#05070d]/90 backdrop-blur-md overflow-hidden rounded-xl border border-cyan-500/30"
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
    >
      <AnimatePresence mode="wait">
        {view === "inbox" && (
          <InboxView
            conversations={conversations}
            activeConversationId={activeConversationId}
            unreadIds={unreadIds}
            onOpenConversation={openConversation}
            onNavigate={setView}
            onlineUsers={onlineUsers}
          />
        )}

        {view === "chat" && (
          <ChatView
            activeConversation={activeConversation}
            messages={messages}
            typingUsers={typingUsers}
            myId={myId}
            input={input}
            onTyping={handleTyping}
            onSendMessage={handleSendMessage}
            onBack={() => setView("inbox")}
          />
        )}

        {view === "search" && (
          <SearchView
            searchTerm={searchTerm}
            searchResults={searchResults}
            searchLoading={searchLoading}
            onSearchChange={handleSearchChange}
            onStartDM={async (userId) => {
              const conv = await createConversation("private", [String(userId)]);
              setConversations(await getConversations());
              openConversation(conv.id);
            }}
            onJoinChannel={async (channelId) => {
              await joinChannel(channelId);
              setConversations(await getConversations());
              openConversation(channelId);
            }}
            onBack={() => setView("inbox")}
          />
        )}

        {view === "create" && (
          <CreateChannelView
            newChannelName={newChannelName}
            setNewChannelName={setNewChannelName}
            newChannelDesc={newChannelDesc}
            setNewChannelDesc={setNewChannelDesc}
            creating={creating}
            onSubmit={async (e) => {
              e.preventDefault();
              setCreating(true);
              try {
                const conv = await createConversation("channel", [], newChannelName, true, newChannelDesc);
                setConversations(await getConversations());
                openConversation(conv.id);
              } finally { setCreating(false); }
            }}
            onBack={() => setView("inbox")}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );
}