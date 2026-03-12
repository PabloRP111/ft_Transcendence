import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Send, MessageSquare, Users } from "lucide-react";

export default function ChatModule() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);

  // Automatically scroll to the latest message [cite: 240, 241]
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    // Front-end validation as required by the subject [cite: 185]
    if (!input.trim()) return;

    // Placeholder for WebSocket emission logic [cite: 240]
    const newMessage = { id: Date.now(), text: input, sender: "me" };
    setMessages([...messages, newMessage]);
    setInput("");
  };

  return (
    <motion.section 
      // Added 'overflow-hidden' to clip internal children to the rounded corners
      // and 'rounded-xl' to match the typical neon-panel curvature
      className="neon-panel flex flex-col h-full bg-[#05070d]/90 backdrop-blur-md overflow-hidden rounded-xl border border-cyan-500/30"
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
    >
      {/* Header section with User Interaction icons [cite: 244] */}
      <div className="p-4 border-b border-cyan-300/20 bg-cyan-950/10 flex justify-between items-center">
        <h2 className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 flex items-center gap-2">
          <MessageSquare size={14} />
          Arena Chat
        </h2>
        <Users size={16} className="text-cyan-400/70 hover:text-cyan-200 cursor-pointer transition-colors" />
      </div>

      {/* Messages display area [cite: 245] */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
      >
        <div className="text-[9px] text-cyan-100/30 uppercase tracking-[0.3em] text-center my-4">
          --- Connection Established ---
        </div>
        
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col animate-in fade-in slide-in-from-left-2">
            <span className="text-[8px] text-cyan-500/60 mb-1 font-bold">USER_ID_0x7F:</span>
            <div className="text-xs text-cyan-50 bg-cyan-950/40 p-2 rounded-r-md rounded-bl-md border-l-2 border-cyan-500/50 max-w-[90%]">
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input form - Ensure it matches the bottom rounded corners of the parent [cite: 185] */}
      <form 
        onSubmit={handleSendMessage} 
        className="p-4 bg-[#0a0f1a] border-t border-cyan-300/10"
      >
        <div className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
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
    </motion.section>
  );
}