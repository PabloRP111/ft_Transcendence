import { useRef } from "react";
import { motion } from "framer-motion";
import { Send, ArrowLeft } from "lucide-react";
import { convDisplayName } from "../../utils/chatStorage";

export default function ChatView({
  activeConversation,
  messages,
  typingUsers,
  myId,
  input,
  onTyping,
  onSendMessage,
  onBack,
}) {
  const scrollRef = useRef(null);

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
        <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 truncate">
          {activeConversation ? convDisplayName(activeConversation) : "Chat"}
        </span>
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

        {/* Last in DOM = top visually with flex-col-reverse */}
        <div className="text-[9px] text-cyan-100/30 uppercase tracking-[0.3em] text-center my-4">
          --- Connection Established ---
        </div>
      </div>

      {/* Input */}
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
    </motion.div>
  );
}
