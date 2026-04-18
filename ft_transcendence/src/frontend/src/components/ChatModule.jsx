import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "react-router-dom";

// API & Hooks
import { getConversations, getMessages, createConversation, searchChannels, joinChannel, leaveChannel } from "../api/chat";
import { searchUsers } from "../api/users";
import { getFriendStatus, sendFriendRequest } from "../api/friends";
import { useChat } from "../hooks/useChat";
import { useAuth } from "../context/AuthContext.jsx";
import { sendGameInvite } from "../utils/gameInvite";

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
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Navigation State ──────────────────────────────────────────────────────
  const [view, setView] = useState("inbox"); // inbox, chat, search, create

  // ── Conversations & Messages ──────────────────────────────────────────────
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  // ── Typing & Unreads ─────────────────────────────────────────────────────
  // Presence (online/offline) is managed globally by PresenceContext
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [unreadIds, setUnreadIds] = useState(new Set());

  // ── Search & Channel Creation ─────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState({ users: [], channels: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const [pendingDmUserId, setPendingDmUserId] = useState(null);
  const [pendingChannelId, setPendingChannelId] = useState(null);

  // True when the active DM has a block in either direction (I blocked them or they blocked me)
  const [dmIsBlocked, setDmIsBlocked] = useState(false);
  // Friend status with the other DM participant: none | pending_sent | pending_received | accepted | blocked | blocked_by
  const [dmFriendStatus, setDmFriendStatus] = useState("none");
  // Timestamp the OTHER participant last read this DM (null for channels or unread)
  const [otherReadAt, setOtherReadAt] = useState(null);
  // Set of conversation IDs where there is a block in either direction
  const [blockedConvIds, setBlockedConvIds] = useState(new Set());

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
    // Update otherReadAt when the other participant reads the conversation
    onMessageRead: ({ conversationId, userId, readAt }) => {
      const myId = getMyIdFromToken();
      if (String(userId) === String(myId)) return; // ignore my own read events
      if (String(conversationId) === String(activeConversationId)) {
        setOtherReadAt(readAt);
      }
    },
    onTypingStart: ({ userId }) => setTypingUsers((prev) => new Set(prev).add(userId)),
    onTypingStop: ({ userId }) => setTypingUsers((prev) => {
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

  // ── Handle ?dm=userId and ?channel=convId — step 1: capture params ─────────
  useEffect(() => {
    const dmUserId = searchParams.get("dm");
    const channelId = searchParams.get("channel");
    if (!dmUserId && !channelId) return;
    if (dmUserId) setPendingDmUserId(dmUserId);
    if (channelId) setPendingChannelId(channelId);
    setSearchParams({}, { replace: true });
  }, [searchParams]);

  // ── Handle ?dm=userId — step 2: open DM once conversations are loaded ──────
  useEffect(() => {
    if (!pendingDmUserId || conversations.length === 0) return;
    const dmUserId = pendingDmUserId;
    setPendingDmUserId(null);

    async function openDM() {
      try {
        const conv = await createConversation("private", [String(dmUserId)]);
        const convs = await getConversations();
        setConversations(convs);
        openConversation(conv.id);
      } catch (err) {
        console.error("[chat] failed to open DM from query param:", err);
      }
    }
    openDM();
  }, [pendingDmUserId, conversations.length]);

  // ── Handle ?channel=convId — step 2: open channel once conversations loaded ─
  useEffect(() => {
    if (!pendingChannelId || conversations.length === 0) return;
    const channelId = pendingChannelId;
    setPendingChannelId(null);
    openConversation(Number(channelId));
  }, [pendingChannelId, conversations.length]);

  // ── Load History + emit markRead ─────────────────────────────────────────
  useEffect(() => {
    if (!activeConversationId) return;

    getMessages(activeConversationId)
      .then(({ messages, otherReadAt: readAt }) => {
        setMessages(messages);
        setOtherReadAt(readAt);
        // Tell the server (and the other participant) that we've read this conversation
        socketRef.current?.emit("markRead", { conversationId: String(activeConversationId) });
      })
      .catch(console.error);
  }, [activeConversationId]);

  // ── Compute blocked status for all DMs (for InboxView Swords button) ────────
  useEffect(() => {
    const dmConvs = conversations.filter(c => c.type === "private");
    if (dmConvs.length === 0) { setBlockedConvIds(new Set()); return; }

    Promise.all(
      dmConvs.map(async (conv) => {
        const otherId = conv.participants?.[0]?.id;
        if (!otherId) return null;
        try {
          const { status } = await getFriendStatus(otherId);
          return (status === "blocked" || status === "blocked_by") ? conv.id : null;
        } catch {
          return null;
        }
      })
    ).then((results) => {
      setBlockedConvIds(new Set(results.filter(Boolean)));
    });
  }, [conversations]);

  // ── Check friend/block status when opening a DM ──────────────────────────
  useEffect(() => {
    if (!activeConversationId) { setDmIsBlocked(false); setDmFriendStatus("none"); return; }

    const conv = conversations.find(c => c.id === activeConversationId);
    if (!conv || conv.type !== "private") { setDmIsBlocked(false); setDmFriendStatus("none"); return; }

    const otherId = conv.participants?.[0]?.id;
    if (!otherId) { setDmIsBlocked(false); setDmFriendStatus("none"); return; }

    getFriendStatus(otherId)
      .then(({ status }) => {
        setDmIsBlocked(status === "blocked" || status === "blocked_by");
        setDmFriendStatus(status);
      })
      .catch(() => { setDmIsBlocked(false); setDmFriendStatus("none"); });
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

        // Filter out the current user, then check block status for each result
        const filteredUsers = users.filter(u => String(u.id) !== String(myId));
        const usersWithBlockStatus = await Promise.all(
          filteredUsers.map(async (u) => {
            try {
              const { status } = await getFriendStatus(u.id);
              return { ...u, cannotDM: status === "blocked" || status === "blocked_by" };
            } catch {
              return { ...u, cannotDM: false };
            }
          })
        );

        setSearchResults({ users: usersWithBlockStatus, channels });
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
            blockedConvIds={blockedConvIds}
            onOpenConversation={openConversation}
            onNavigate={setView}
            onLeaveChannel={async (convId) => {
              await leaveChannel(convId);
              setConversations((prev) => prev.filter((c) => c.id !== convId));
              if (activeConversationId === convId) setActiveConversationId(null);
            }}
            onGameInvite={(conv) => {
              const other = conv.participants?.[0];
              if (!other) return;
              sendGameInvite(socketRef, other.id, other.username);
            }}
          />
        )}

        {view === "chat" && (
          <ChatView
            activeConversation={activeConversation}
            messages={messages}
            typingUsers={typingUsers}
            myId={myId}
            input={input}
            isBlocked={dmIsBlocked}
            dmFriendStatus={dmFriendStatus}
            otherReadAt={otherReadAt}
            onAddFriend={async () => {
              const otherId = activeConversation?.participants?.[0]?.id;
              if (!otherId) return;
              await sendFriendRequest(otherId).catch(() => {});
              setDmFriendStatus("pending_sent");
            }}
            onGameInvite={() => {
              const other = activeConversation?.participants?.[0];
              if (!other) return;
              sendGameInvite(socketRef, other.id, other.username);
            }}
            onTyping={handleTyping}
            onSendMessage={handleSendMessage}
            onBack={() => setView("inbox")}
            onLeaveChannel={async () => {
              await leaveChannel(activeConversationId);
              setConversations((prev) => prev.filter((c) => c.id !== activeConversationId));
              setActiveConversationId(null);
              setView("inbox");
            }}
          />
        )}

        {view === "search" && (
          <SearchView
            searchTerm={searchTerm}
            searchResults={searchResults}
            searchLoading={searchLoading}
            conversations={conversations}
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
            onOpenConversation={openConversation}
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