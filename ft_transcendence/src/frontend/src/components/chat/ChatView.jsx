import { useRef } from "react";
import { motion } from "framer-motion";
import { Send, ArrowLeft, LogOut, UserPlus, Clock, UserCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { convDisplayName } from "../../utils/chatStorage";
import { usePresence } from "../../context/PresenceContext";

export default function ChatView({
  activeConversation,
  messages,
  typingUsers,
  myId,
  input,
  isBlocked,
  dmFriendStatus,
  otherReadAt,
  onAddFriend,
  onTyping,
  onSendMessage,
  onBack,
  onLeaveChannel,
}) {
  const scrollRef = useRef(null);
  const onlineUsers = usePresence();
  const navigate = useNavigate();

  const isDM = activeConversation?.type === "private";
  const isArena = activeConversation?.name?.toLowerCase() === "arena_general";
  const isLeavable = !isDM && !isArena;
  const isOtherOnline = isDM && activeConversation?.participants?.some(
    (p) => onlineUsers.has(String(p.id))
  );

  // ID of the last message I sent — used to show the "Read" receipt under it
  const lastSentMessageId = isDM
    ? [...messages].reverse().find((m) => String(m.senderId) === String(myId))?.id
    : null;

  return (
    <motion.div
      key="chat"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="p-4 border-b border-cyan-300/20 bg-cyan-950/10 flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-cyan-100/40 hover:text-cyan-300 transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex flex-col min-w-0 flex-1">
          {isDM ? (
            <button
              onClick={() => {
                const other = activeConversation?.participants?.[0];
                if (other?.username) navigate(`/profile/${other.username}`);
              }}
              className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 truncate hover:text-cyan-200 transition-colors text-left"
            >
              {convDisplayName(activeConversation)}
            </button>
          ) : (
            <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 truncate">
              {activeConversation ? convDisplayName(activeConversation) : "Chat"}
            </span>
          )}
          {isDM && (
            <div className="flex items-center gap-2">
              <span className={`text-[8px] font-mono flex items-center gap-1 ${isOtherOnline ? "text-green-400" : "text-cyan-100/30"}`}>
                <span className={`w-1 h-1 rounded-full inline-block ${isOtherOnline ? "bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.8)]" : "bg-gray-600"}`} />
                {isOtherOnline ? "online" : "offline"}
              </span>
              {/* Friend status indicator — only shown for DMs without a block */}
              {!isBlocked && dmFriendStatus === "none" && (
                <button onClick={onAddFriend} className="flex items-center gap-0.5 text-[8px] text-cyan-400/50 hover:text-cyan-300 transition-colors" title="Add friend">
                  <UserPlus size={10} />
                </button>
              )}
              {!isBlocked && dmFriendStatus === "pending_sent" && (
                <span className="flex items-center gap-0.5 text-[8px] text-yellow-400/50" title="Friend request sent">
                  <Clock size={10} />
                </span>
              )}
              {!isBlocked && dmFriendStatus === "accepted" && (
                <span className="flex items-center gap-0.5 text-[8px] text-green-400/40" title="Friends">
                  <UserCheck size={10} />
                </span>
              )}
            </div>
          )}
        </div>
        {isLeavable && (
          <button
            onClick={onLeaveChannel}
            className="text-cyan-100/20 hover:text-red-400 transition-colors"
            title="Leave channel"
          >
            <LogOut size={14} />
          </button>
        )}
      </div>

      {/* Messages — flex-col-reverse so scroll starts at bottom without JS */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col-reverse gap-4 custom-scrollbar">
        <div /> {/* bottom spacer */}

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
                {isMe ? "YOU" : (
                  <button
                    onClick={() => navigate(`/profile/${msg.sender?.username}`)}
                    className="hover:text-cyan-300 transition-colors"
                  >
                    {msg.sender?.username || `USER_${msg.senderId}`}
                  </button>
                )}:
              </span>
              <div className={`text-xs p-2 rounded-md font-mono max-w-[90%] ${
                isMe
                  ? "bg-cyan-500/20 border-r-2 border-cyan-400 text-cyan-100"
                  : "bg-cyan-950/40 border-l-2 border-cyan-500/50 text-cyan-50"
              }`}>
                {msg.content}
              </div>
              <span className="text-[7px] text-cyan-100/20 mt-1 px-1 font-mono">{time}</span>
              {/* Read receipt — only on the last message I sent, only in DMs */}
              {isMe && msg.id === lastSentMessageId && otherReadAt && new Date(otherReadAt) >= new Date(msg.createdAt) && (
                <span className="text-[7px] text-cyan-400/40 px-1 font-mono">Read</span>
              )}
            </div>
          );
        })}

        {typingUsers.size > 0 && (
          <div className="text-[9px] text-cyan-400/60 italic animate-pulse">
            Someone is typing...
          </div>
        )}

        {/* Last in DOM = top visually with flex-col-reverse */}
        <div className="text-[9px] text-cyan-100/30 uppercase tracking-[0.3em] text-center my-4">
          --- Connection Established ---
        </div>
      </div>

      {/* Input — replaced with a notice if the DM has a block in either direction */}
      {isBlocked ? (
        <div className="p-4 bg-[#0a0f1a] border-t border-cyan-300/10 flex items-center justify-center">
          <p className="text-[10px] uppercase tracking-[0.2em] text-red-400/60 font-mono">
            You cannot message this user
          </p>
        </div>
      ) : (
        <form onSubmit={onSendMessage} className="p-4 bg-[#0a0f1a] border-t border-cyan-300/10">
          <div className="relative group">
            <input
              type="text"
              value={input}
              onChange={onTyping}
              className="w-full bg-voidBlack border border-cyan-900/50 rounded-lg p-3 pr-12 text-xs text-cyan-50 placeholder-cyan-700/50 focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-400 outline-none transition-all font-mono"
              placeholder="TYPE_MESSAGE..."
            />
            <button
              type="submit"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-500 hover:text-cyan-300 disabled:text-cyan-900"
              disabled={!activeConversation}
            >
              <Send size={18} />
            </button>
          </div>
        </form>
      )}
    </motion.div>
  );
}
