import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Users, MessageSquare } from "lucide-react";

export default function ChatModule() {
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);

  // UseEffect to handle WebSocket connection
  useEffect(() => {
    // Logic to connect to the chat microservice would go here
    // Example: const socket = io("https://localhost:8443/chat");
    
    return () => {
      // Clean up the connection when the component unmounts or user logs out
    };
  }, []);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    // Logic to emit the message via WebSockets
    console.log("Sending:", message);
    setMessage("");
  };

  return (
    <motion.section 
      className="neon-panel flex flex-col h-full bg-[#05070d]/90 backdrop-blur-sm border-l-2 border-cyan-500/30"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Chat Header */}
      <div className="p-3 border-b border-cyan-300/20 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 flex items-center gap-2">
          <MessageSquare size={14} />
          Arena Chat
        </span>
        <Users size={14} className="text-cyan-100/50 cursor-pointer hover:text-cyan-400" />
      </div>

      {/* Message Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {/* Placeholder for messages - You will map your chatHistory here */}
        <div className="text-[10px] text-cyan-100/40 uppercase tracking-widest text-center mt-10">
          --- Connection Established ---
        </div>
      </div>

      {/* Input Area */}
      <form onSubmit={sendMessage} className="p-3 bg-[#0a0f1a] border-t border-cyan-300/10">
        <div className="relative flex items-center">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type message..."
            className="w-full bg-voidBlack border border-cyan-900/50 rounded-md py-2 pl-3 pr-10 text-xs text-cyan-50 focus:outline-none focus:border-cyan-400 transition-colors"
          />
          <button 
            type="submit"
            className="absolute right-2 text-cyan-500 hover:text-cyan-300 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </motion.section>
  );
}