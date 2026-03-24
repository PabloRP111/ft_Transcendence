import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getConversations, getMessages, createConversation, searchChannels, joinChannel } from "../api/chat";
import { searchUsers } from "../api/users";
import { useChat } from "../hooks/useChat";
import { getMyIdFromToken, getLastOpened, saveLastOpened } from "../utils/chatStorage";
import InboxView from "./chat/InboxView";
import ChatView from "./chat/ChatView";
import SearchView from "./chat/SearchView";
import CreateChannelView from "./chat/CreateChannelView";

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
  const myId = getMyIdFromToken();

  // ── Navigation ─────────────────────────────────────────────────────────────
  const [view, setView] = useState("inbox");

  // ── Conversations ──────────────────────────────────────────────────────────
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const activeConversation = conversations.find(c => c.id === activeConversationId) ?? null;

  // ── Messages ───────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  // ── Search ─────────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState({ users: [], channels: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef(null);

  // ── Presence / typing ──────────────────────────────────────────────────────
  const [typingUsers, setTypingUsers] = useState(new Set());

  // ── Unread badges ──────────────────────────────────────────────────────────
  const [unreadIds, setUnreadIds] = useState(new Set());

  // ── Create channel form ────────────────────────────────────────────────────
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const typingTimerRef = useRef(null);
  const isInitializing = useRef(false);

  // ── WebSocket ──────────────────────────────────────────────────────────────
  const socketRef = useChat(activeConversationId, {
    onNewMessage: (msg) => {
      // Bump lastMessageAt so the inbox re-sorts immediately
      setConversations((prev) => prev.map((c) =>
        String(c.id) === String(msg.conversationId)
          ? { ...c, lastMessageAt: msg.createdAt }
          : c
      ));
      if (String(msg.conversationId) === String(activeConversationId)) {
        setMessages((prev) => [...prev, msg]);
      } else {
        setUnreadIds((prev) => new Set(prev).add(msg.conversationId));
      }
    },
    onMessageFailed: (err) => console.error("[chat] message failed:", err),
    onTypingStart: ({ userId }) =>
      setTypingUsers((prev) => new Set(prev).add(userId)),
    onTypingStop: ({ userId }) =>
      setTypingUsers((prev) => { const n = new Set(prev); n.delete(userId); return n; }),
  });

  // ── Load conversations on mount ────────────────────────────────────────────
  // Ensures Arena_General exists, seeds unread badges from localStorage.
  useEffect(() => {
    async function initializeChat() {
      if (isInitializing.current) return;
      isInitializing.current = true;
      try {
        let convs = await getConversations();
        if (!convs.some(c => c.type === "channel")) {
          await createConversation("channel", [], "Arena_General");
          convs = await getConversations();
        }
        setConversations(convs);

        const offlineUnread = new Set();
        const uid = getMyIdFromToken();
        convs.forEach((conv) => {
          if (!conv.lastMessageAt) return;
          const lastOpened = getLastOpened(uid, conv.id);
          if (!lastOpened || new Date(conv.lastMessageAt) > lastOpened) {
            offlineUnread.add(conv.id);
          }
        });
        if (offlineUnread.size > 0) setUnreadIds(offlineUnread);
      } catch (err) {
        console.error("[chat] failed to initialize:", err);
      }
    }
    initializeChat();
  }, []);

  // ── Load messages when active conversation changes ─────────────────────────
  useEffect(() => {
    if (!activeConversationId) return;
    getMessages(activeConversationId).then(setMessages).catch(console.error);
  }, [activeConversationId]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openConversation = (convId) => {
    setActiveConversationId(convId);
    setView("chat");
    saveLastOpened(getMyIdFromToken(), convId);
    setUnreadIds((prev) => { const n = new Set(prev); n.delete(convId); n.delete(String(convId)); return n; });
  };

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

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchTerm(q);
    clearTimeout(searchTimerRef.current);
    if (!q.trim()) { setSearchResults({ users: [], channels: [] }); return; }
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

  const handleStartDM = async (userId) => {
    try {
      const conv = await createConversation("private", [String(userId)]);
      const convs = await getConversations();
      setConversations(convs);
      setSearchTerm("");
      setSearchResults({ users: [], channels: [] });
      openConversation(conv.id);
    } catch (err) {
      console.error("[chat] failed to start DM:", err);
    }
  };

  const handleJoinChannel = async (channelId) => {
    try {
      await joinChannel(channelId);
      const convs = await getConversations();
      setConversations(convs);
      setSearchTerm("");
      setSearchResults({ users: [], channels: [] });
      openConversation(channelId);
    } catch (err) {
      console.error("[chat] failed to join channel:", err);
    }
  };

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!newChannelName.trim() || creating) return;
    setCreating(true);
    try {
      const conv = await createConversation("channel", [], newChannelName.trim(), true, newChannelDesc.trim() || null);
      const convs = await getConversations();
      setConversations(convs);
      setNewChannelName("");
      setNewChannelDesc("");
      openConversation(conv.id);
    } catch (err) {
      console.error("[chat] failed to create channel:", err);
    } finally {
      setCreating(false);
    }
  };

  // ── Render ─────────────
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
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onOpenConversation={openConversation}
            onNavigate={setView}
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
            conversations={conversations}
            onSearchChange={handleSearchChange}
            onStartDM={handleStartDM}
            onJoinChannel={handleJoinChannel}
            onOpenConversation={openConversation}
            onBack={() => { setSearchTerm(""); setSearchResults({ users: [], channels: [] }); setView("inbox"); }}
          />
        )}
        {view === "create" && (
          <CreateChannelView
            newChannelName={newChannelName}
            setNewChannelName={setNewChannelName}
            newChannelDesc={newChannelDesc}
            setNewChannelDesc={setNewChannelDesc}
            creating={creating}
            onSubmit={handleCreateChannel}
            onBack={() => { setNewChannelName(""); setView("inbox"); }}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );
}
