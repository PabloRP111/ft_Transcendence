import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, MessageSquare, Users, UserPlus, User, Search } from "lucide-react";

/* Mock data for front-end development - Requirement IV.3 */
const MOCK_FRIENDS = [
  { id: 1, name: "Neon_Rider", status: "online" },
  { id: 2, name: "Bit_Crusher", status: "offline" },
  { id: 3, name: "Flynn_Grid", status: "online" },
];

export default function ChatModule() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState("chat"); // 'chat' or 'friends' 
  const [searchTerm, setSearchTerm] = useState("");
  const scrollRef = useRef(null);

  // Automatically scroll to the latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeTab]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    // Front-end validation as required by the subject 
    if (!input.trim()) return;
    // Placeholder for WebSocket emission logic 
    const newMessage = { id: Date.now(), text: input, sender: "me" };
    setMessages([...messages, newMessage]);
    setInput("");
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
                  <span className="text-[8px] text-cyan-500/60 mb-1 font-bold">USER_ID_0x7F:</span>
                  <div className="text-xs text-cyan-50 bg-cyan-950/40 p-2 rounded-r-md rounded-bl-md border-l-2 border-cyan-500/50 max-w-[90%]">
                    {msg.text}
                  </div>
                </div>
              ))}
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
              
              {/* Friends List - Requirement IV.3  */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {MOCK_FRIENDS.map((friend) => (
                  <div key={friend.id} className="flex items-center justify-between p-2 border border-cyan-500/10 bg-cyan-950/20 rounded group hover:border-cyan-500/30 transition-all">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${friend.status === 'online' ? 'bg-green-400 shadow-[0_0_5px_#4ade80]' : 'bg-gray-600'}`} />
                      <span className="text-[11px] text-cyan-50">{friend.name}</span>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button title="Profile" className="text-cyan-400 hover:text-cyan-200"><User size={14} /></button>
                      <button title="Add Friend" className="text-cyan-400 hover:text-cyan-200"><UserPlus size={14} /></button>
                    </div>
                  </div>
                ))}
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
      )}
    </motion.section>
  );
}