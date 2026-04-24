import { Fragment, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, LogOut, Swords, ArrowUpDown } from "lucide-react";
import { convDisplayName } from "../../utils/chatStorage";
import { usePresence } from "../../context/PresenceContext";
import { useActiveMatch } from "../../hooks/useActiveMatch";

export default function InboxView({
  conversations,
  activeConversationId,
  unreadIds,
  blockedConvIds = new Set(),
  onOpenConversation,
  onNavigate,
  onLeaveChannel,
  onGameInvite,
}) {
  const onlineUsers = usePresence();
  const hasActiveMatch = useActiveMatch();
  const [page, setPage] = useState(0);
  const pageSize = 8;
  const [sortAlpha, setSortAlpha] = useState(false);

  const sorted = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const aIsArena = a.name?.toLowerCase() === "arena_general";
      const bIsArena = b.name?.toLowerCase() === "arena_general";
      if (aIsArena) return -1;
      if (bIsArena) return 1;
      if (sortAlpha) {
        return convDisplayName(a).localeCompare(convDisplayName(b), undefined, { sensitivity: "base" });
      }
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [conversations, sortAlpha]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * pageSize;
  const pageItems = sorted.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  // For a DM, check if the other participant is online
  const isDMOnline = (conv) => {
    if (conv.type !== "private") return false;
    return conv.participants?.some((p) => onlineUsers.has(String(p.id)));
  };

  return (
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSortAlpha((value) => !value);
              setPage(0);
            }}
            className={`rounded-md border px-1.5 py-1 transition-colors ${
              sortAlpha
                ? "border-cyan-400/60 bg-cyan-900/40 text-cyan-200"
                : "border-cyan-900/40 text-cyan-100/40 hover:text-cyan-300"
            }`}
            aria-label="Toggle chat sort order"
            aria-pressed={sortAlpha}
            title={sortAlpha ? "Sort by most recent" : "Sort alphabetically"}
          >
            <ArrowUpDown size={14} />
          </button>
          <button
            onClick={() => onNavigate("create")}
            className="text-cyan-100/40 hover:text-cyan-300 transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Search input — focuses into SearchView */}
      <div className="p-3 border-b border-cyan-300/10">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-cyan-500/40" size={12} />
          <input
            type="text"
            placeholder="Search entities..."
            onFocus={() => onNavigate("search")}
            readOnly
            className="w-full bg-voidBlack/50 border border-cyan-500/20 rounded-md py-1.5 pl-7 pr-3 text-[10px] text-cyan-50 focus:outline-none focus:border-cyan-400/50 cursor-pointer"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {pageItems.map((conv, idx) => {
          const isArena = conv.name?.toLowerCase() === "arena_general";
          const hasUnread = unreadIds.has(conv.id) || unreadIds.has(String(conv.id));
          const isOnline = isDMOnline(conv);

          // Dot: green if online, gray otherwise
          const dotClass = isOnline
            ? "bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.8)]"
            : "bg-gray-600";

          const isLeavable = conv.type === "channel" && !isArena;

          return (
            <Fragment key={conv.id}>
              <div
                className={`flex items-center gap-2 p-2 border rounded transition-all
                  ${activeConversationId === conv.id
                    ? "border-cyan-500/60 bg-cyan-950/40"
                    : "border-cyan-500/10 bg-cyan-950/20 hover:border-cyan-500/30"}`}
              >
                <div
                  onClick={() => onOpenConversation(conv.id)}
                  className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                >
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass}`} />
                  <span className="text-[11px] text-cyan-50 font-mono truncate">
                    {convDisplayName(conv)}
                  </span>
                  {hasUnread && (
                    <span className="flex-shrink-0 rounded-full bg-orange-500 min-w-[16px] h-4 flex items-center justify-center px-1 text-[9px] text-white font-bold leading-none">
                      1
                    </span>
                  )}
                </div>
                {conv.type === "private" && isOnline && !blockedConvIds.has(conv.id) && !hasActiveMatch && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onGameInvite?.(conv); }}
                    className="flex-shrink-0 text-cyan-100/20 hover:text-cyan-300 transition-colors"
                    title="Challenge to a game"
                  >
                    <Swords size={12} />
                  </button>
                )}
                {isLeavable && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onLeaveChannel?.(conv.id); }}
                    className="flex-shrink-0 text-cyan-100/20 hover:text-red-400 transition-colors"
                    title="Leave channel"
                  >
                    <LogOut size={12} />
                  </button>
                )}
              </div>
              {/* Divider pins arena_general above the rest */}
              {isArena && idx < pageItems.length - 1 && (
                <div className="border-t border-cyan-500/20 my-1" />
              )}
            </Fragment>
          );
        })}
      </div>

      <div className="p-3 pt-2 border-t border-cyan-300/10 flex items-center justify-between">
        <button
          className="neon-button px-3 py-2 text-[10px] uppercase tracking-widest flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => setPage((value) => Math.max(0, value - 1))}
          disabled={safePage === 0 || totalPages <= 1}
          aria-label="Previous chat page"
        >
          Prev
        </button>
        <div className="text-[10px] text-cyan-500 uppercase tracking-[0.3em]">
          {safePage + 1} / {totalPages}
        </div>
        <button
          className="neon-button px-3 py-2 text-[10px] uppercase tracking-widest flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}
          disabled={safePage >= totalPages - 1 || totalPages <= 1}
          aria-label="Next chat page"
        >
          Next
        </button>
      </div>
    </motion.div>
  );
}
