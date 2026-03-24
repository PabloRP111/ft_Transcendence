import { useState, useEffect, useRef, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Search, ArrowLeft, Plus } from "lucide-react";
import { getConversations, getMessages, createConversation, searchChannels, joinChannel } from "../api/chat";
import { searchUsers } from "../api/users";
import { useChat } from "../hooks/useChat";

// Decode the JWT stored in localStorage to get the current user's id.
// Avoids needing an extra API call or hook just for the id.
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

// ── localStorage helpers for unread tracking ──────────────────────────────
// We store the timestamp of when the user last opened each conversation.
// On load we compare that against the conversation's latest message to detect
// messages that arrived while the user was offline.
const LAST_OPENED_KEY = (userId, convId) => `chat_last_opened_${userId}_${convId}`;

const getLastOpened = (userId, convId) => {
  const val = localStorage.getItem(LAST_OPENED_KEY(userId, convId));
  return val ? new Date(val) : null;
};

const saveLastOpened = (userId, convId) => {
  localStorage.setItem(LAST_OPENED_KEY(userId, convId), new Date().toISOString());
};

/*
 * Views (navigation stack):
 *   "inbox"  — list of conversations (default)
 *   "chat"   — active conversation (M1)
 *   "search" — search users/channels (M3)
 *   "create" — create new channel (M4)
 */
export default function ChatModule() {
  const myId = getMyIdFromToken();

  // ── State ──────────────────────────────────────────────────────────────────
  const [view, setView] = useState("inbox");
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState({ users: [], channels: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [unreadIds, setUnreadIds] = useState(new Set());

  const scrollRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isInitializing = useRef(false);

  // Derived: full conversation object for the active conversation
  const activeConversation = conversations.find(c => c.id === activeConversationId) ?? null;

  // ── WebSocket ──────────────────────────────────────────────────────────────
  const socketRef = useChat(activeConversationId, {
    onNewMessage: (msg) => {
      // Bump lastMessageAt on the conversation so the inbox re-sorts immediately
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
    onUserOnline: ({ userId }) =>
      setOnlineUsers((prev) => new Set(prev).add(userId)),
    onUserOffline: ({ userId }) =>
      setOnlineUsers((prev) => { const n = new Set(prev); n.delete(userId); return n; }),
  });

  // ── Load conversations on mount ────────────────────────────────────────────
  // Ensures Arena_General exists (find-or-create) but does NOT auto-navigate
  // to it — the user starts on the inbox and chooses where to go.
  // Also seeds unreadIds from localStorage so offline messages show a badge.
  useEffect(() => {
    async function initializeChat() {
      if (isInitializing.current) return;
      isInitializing.current = true;
      try {
        let convs = await getConversations();
        const hasArena = convs.some(c => c.type === "channel");
        if (!hasArena) {
          await createConversation("channel", [], "Arena_General");
          convs = await getConversations();
        }
        setConversations(convs);

        // Detect offline unreads: if a conversation has a message newer than
        // the last time we opened it, mark it unread immediately on load.
        const offlineUnread = new Set();
        const uid = getMyIdFromToken();
        convs.forEach((conv) => {
          if (!conv.lastMessageAt) return;
          const lastOpened = getLastOpened(uid, conv.id);
          // No record means the user never opened it — treat as unread if there are messages
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

  // ── Load messages when conversation changes ────────────────────────────────
  useEffect(() => {
    if (!activeConversationId) return;
    getMessages(activeConversationId).then(setMessages).catch(console.error);
  }, [activeConversationId]);


  // ── Handlers ──────────────────────────────────────────────────────────────
  const openConversation = (convId) => {
    setActiveConversationId(convId);
    setView("chat");
    // Persist when the user opened this conversation so we can detect
    // offline unreads on the next login
    saveLastOpened(getMyIdFromToken(), convId);
    // Clear the unread badge for this conversation when the user opens it
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

  // ── Conversation display name ──────────────────────────────────────────────
  // For private DMs the backend now returns a `participants` array with the
  // other user(s). We use the first entry's username as the display name.
  const convDisplayName = (conv) => {
    if (conv.type === "private") {
      return conv.participants?.[0]?.username || "Direct_Link";
    }
    return conv.name || "Public_Channel";
  };

  // ── Search — debounced, fires both user and channel queries ───────────────
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

  // Start a DM with a user — creates conversation and opens it
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

  // Join a public channel and open it
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

  // ── Create channel ────────────────────────────────────────────────────────
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const [newChannelPublic, setNewChannelPublic] = useState(true);
  const [creating, setCreating] = useState(false);

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!newChannelName.trim() || creating) return;
    setCreating(true);
    try {
      const conv = await createConversation("channel", [], newChannelName.trim(), newChannelPublic, newChannelDesc.trim() || null);
      const convs = await getConversations();
      setConversations(convs);
      setNewChannelName("");
      setNewChannelDesc("");
      setNewChannelPublic(true);
      openConversation(conv.id);
    } catch (err) {
      console.error("[chat] failed to create channel:", err);
    } finally {
      setCreating(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <motion.section
      className="neon-panel flex flex-col h-full bg-[#05070d]/90 backdrop-blur-md overflow-hidden rounded-xl border border-cyan-500/30"
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
    >
      <AnimatePresence mode="wait">

        {/* ── VISTA 1: Inbox ──────────────────────────────────────────────── */}
        {view === "inbox" && (
          <motion.div
            key="inbox"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex flex-col h-full"
          >
            {/* Header */}
            <div className="p-4 border-b border-cyan-300/20 bg-cyan-950/10 flex justify-between items-center">
              <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-400">
                Channels
              </span>
              {/* + button — will open create channel view in M4 */}
              <button
                onClick={() => setView("create")}
                className="text-cyan-100/40 hover:text-cyan-300 transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>

            {/* Search input */}
            <div className="p-3 border-b border-cyan-300/10">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-cyan-500/40" size={12} />
                <input
                  type="text"
                  placeholder="Search entities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setView("search")}
                  className="w-full bg-voidBlack/50 border border-cyan-500/20 rounded-md py-1.5 pl-7 pr-3 text-[10px] text-cyan-50 focus:outline-none focus:border-cyan-400/50"
                />
              </div>
            </div>

            {/* Conversations list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {[...conversations]
                // arena_general pinned first, rest sorted by most recent message
                .sort((a, b) => {
                  const aIsArena = a.name?.toLowerCase() === "arena_general";
                  const bIsArena = b.name?.toLowerCase() === "arena_general";
                  if (aIsArena) return -1;
                  if (bIsArena) return 1;
                  const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
                  const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
                  return bTime - aTime;
                })
                .map((conv, idx, sorted) => {
                  const isArena = conv.name?.toLowerCase() === "arena_general";
                  const hasUnread = unreadIds.has(conv.id) || unreadIds.has(String(conv.id));
                  return (
                    <Fragment key={conv.id}>
                      <div
                        onClick={() => openConversation(conv.id)}
                        className={`flex items-center gap-2 p-2 border rounded cursor-pointer transition-all
                          ${activeConversationId === conv.id
                            ? "border-cyan-500/60 bg-cyan-950/40"
                            : "border-cyan-500/10 bg-cyan-950/20 hover:border-cyan-500/30"}`}
                      >
                        {/* Dot: orange with glow if unread, subtle gray otherwise */}
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          hasUnread
                            ? "bg-orange-400 shadow-[0_0_4px_rgba(251,146,60,0.8)]"
                            : "bg-gray-600"
                        }`} />
                        <span className="text-[11px] text-cyan-50 font-mono truncate">
                          {convDisplayName(conv)}
                        </span>
                      </div>
                      {/* Divider after arena_general to visually pin it above the rest */}
                      {isArena && idx < sorted.length - 1 && (
                        <div className="border-t border-cyan-500/20 my-1" />
                      )}
                    </Fragment>
                  );
                })}
            </div>
          </motion.div>
        )}

        {/* ── VISTA 4: Chat activo ─────────────────────────────────────────── */}
        {view === "chat" && (
          <motion.div
            key="chat"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex flex-col h-full"
          >
            {/* Header with back button + conversation name */}
            <div className="p-4 border-b border-cyan-300/20 bg-cyan-950/10 flex items-center gap-3">
              <button
                onClick={() => setView("inbox")}
                className="text-cyan-100/40 hover:text-cyan-300 transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
              <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 truncate">
                {activeConversation ? convDisplayName(activeConversation) : "Chat"}
              </span>
            </div>

            {/* Messages */}
            {/* flex-col-reverse: first DOM child = bottom visually, scroll starts at bottom */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col-reverse gap-4 custom-scrollbar">
              <div /> {/* spacer so the last message doesn't touch the bottom edge */}

              {[...messages].reverse().map((msg) => {
                const isMe = String(msg.senderId) === String(myId);
                const time = msg.createdAt
                  ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "";

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col animate-in fade-in slide-in-from-left-2 ${isMe ? "items-end" : "items-start"}`}
                  >
                    <span className={`text-[8px] mb-1 font-bold ${isMe ? "text-cyan-300" : "text-cyan-500/60"}`}>
                      {isMe ? "YOU" : (msg.sender?.username || `USER_${msg.senderId}`)}:
                    </span>
                    <div className={`text-xs p-2 rounded-md font-mono max-w-[90%] ${
                      isMe
                        ? "bg-cyan-500/20 border-r-2 border-cyan-400 text-cyan-100"
                        : "bg-cyan-950/40 border-l-2 border-cyan-500/50 text-cyan-50"
                    }`}>
                      {msg.content}
                    </div>
                    <span className="text-[7px] text-cyan-100/20 mt-1 px-1 font-mono">{time}</span>
                  </div>
                );
              })}

              {typingUsers.size > 0 && (
                <div className="text-[9px] text-cyan-400/60 italic animate-pulse">
                  Someone is typing...
                </div>
              )}

              {/* "Connection Established" at the top — last in DOM = top visually with flex-col-reverse */}
              <div className="text-[9px] text-cyan-100/30 uppercase tracking-[0.3em] text-center my-4">
                --- Connection Established ---
              </div>
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-4 bg-[#0a0f1a] border-t border-cyan-300/10">
              <div className="relative group">
                <input
                  type="text"
                  value={input}
                  onChange={handleTyping}
                  className="w-full bg-voidBlack border border-cyan-900/50 rounded-lg p-3 pr-12 text-xs text-cyan-50 placeholder-cyan-700/50 focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-400 outline-none transition-all font-mono"
                  placeholder="TYPE_MESSAGE..."
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
          </motion.div>
        )}

        {/* ── VISTA 2: Search ──────────────────────────────────────────────── */}
        {view === "search" && (
          <motion.div
            key="search"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full"
          >
            {/* Header with back + search input */}
            <div className="p-4 border-b border-cyan-300/20 bg-cyan-950/10 flex items-center gap-3">
              <button
                onClick={() => { setSearchTerm(""); setSearchResults({ users: [], channels: [] }); setView("inbox"); }}
                className="text-cyan-100/40 hover:text-cyan-300 transition-colors flex-shrink-0"
              >
                <ArrowLeft size={16} />
              </button>
              <input
                type="text"
                autoFocus
                placeholder="Search users or channels..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="flex-1 bg-transparent text-[10px] text-cyan-50 outline-none placeholder-cyan-700/50"
              />
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
              {searchLoading && (
                <div className="text-[9px] text-cyan-400/50 uppercase tracking-widest text-center animate-pulse">
                  Scanning...
                </div>
              )}

              {/* Users section */}
              {searchResults.users.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[8px] uppercase tracking-[0.3em] text-cyan-500/50 px-1 mb-2">Users</div>
                  {searchResults.users.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-2 border border-cyan-500/10 bg-cyan-950/20 rounded">
                      <span className="text-[11px] text-cyan-50 font-mono">{user.username}</span>
                      <button
                        onClick={() => handleStartDM(user.id)}
                        className="text-[9px] uppercase tracking-widest text-cyan-400 hover:text-cyan-200 border border-cyan-500/30 hover:border-cyan-400 px-2 py-0.5 rounded transition-all"
                      >
                        DM
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Channels section */}
              {searchResults.channels.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[8px] uppercase tracking-[0.3em] text-cyan-500/50 px-1 mb-2">Channels</div>
                  {searchResults.channels.map((ch) => {
                    const alreadyJoined = conversations.some(c => c.id === ch.id);
                    return (
                      <div key={ch.id} className="flex items-center justify-between p-2 border border-cyan-500/10 bg-cyan-950/20 rounded">
                        <span className="text-[11px] text-cyan-50 font-mono">{ch.name}</span>
                        {alreadyJoined ? (
                          <button
                            onClick={() => openConversation(ch.id)}
                            className="text-[9px] uppercase tracking-widest text-cyan-400 hover:text-cyan-200 border border-cyan-500/30 hover:border-cyan-400 px-2 py-0.5 rounded transition-all"
                          >
                            Open
                          </button>
                        ) : (
                          <button
                            onClick={() => handleJoinChannel(ch.id)}
                            className="text-[9px] uppercase tracking-widest text-cyan-400 hover:text-cyan-200 border border-cyan-500/30 hover:border-cyan-400 px-2 py-0.5 rounded transition-all"
                          >
                            Join
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Empty state */}
              {!searchLoading && searchTerm && searchResults.users.length === 0 && searchResults.channels.length === 0 && (
                <div className="text-[9px] text-cyan-100/30 uppercase tracking-widest text-center mt-8">
                  No results
                </div>
              )}

              {/* Hint before typing */}
              {!searchTerm && (
                <div className="text-[9px] text-cyan-100/20 uppercase tracking-widest text-center mt-8">
                  Type to search
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── VISTA 3: Create channel ──────────────────────────────────────── */}
        {view === "create" && (
          <motion.div
            key="create"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full"
          >
            <div className="p-4 border-b border-cyan-300/20 bg-cyan-950/10 flex items-center gap-3">
              <button
                onClick={() => { setNewChannelName(""); setView("inbox"); }}
                className="text-cyan-100/40 hover:text-cyan-300 transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
              <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-400">
                Create Channel
              </span>
            </div>

            <form onSubmit={handleCreateChannel} className="flex flex-col gap-4 p-4">
              {/* Name */}
              <div className="flex flex-col gap-1">
                <label className="text-[8px] uppercase tracking-[0.3em] text-cyan-500/60">
                  Channel Name
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="e.g. Grid_Zone"
                  maxLength={100}
                  className="bg-voidBlack border border-cyan-900/50 rounded-lg p-3 text-xs text-cyan-50 placeholder-cyan-700/50 focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-400 outline-none font-mono"
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1">
                <label className="text-[8px] uppercase tracking-[0.3em] text-cyan-500/60">
                  Description <span className="normal-case tracking-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  placeholder="What is this channel about?"
                  maxLength={200}
                  className="bg-voidBlack border border-cyan-900/50 rounded-lg p-3 text-xs text-cyan-50 placeholder-cyan-700/50 focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-400 outline-none font-mono"
                />
              </div>

              {/* Public / Private toggle */}
              <div className="flex items-center justify-between">
                <span className="text-[8px] uppercase tracking-[0.3em] text-cyan-500/60">
                  {newChannelPublic ? "Public" : "Private"}
                </span>
                <button
                  type="button"
                  onClick={() => setNewChannelPublic((v) => !v)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${newChannelPublic ? "bg-cyan-500/50" : "bg-cyan-900/50"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-cyan-50 transition-all ${newChannelPublic ? "left-5" : "left-0.5"}`} />
                </button>
              </div>

              <button
                type="submit"
                disabled={!newChannelName.trim() || creating}
                className="w-full py-2 text-[10px] uppercase tracking-[0.2em] border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-all"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </form>
          </motion.div>
        )}

      </AnimatePresence>
    </motion.section>
  );
}
