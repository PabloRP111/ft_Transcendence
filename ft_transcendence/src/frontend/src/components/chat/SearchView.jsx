import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

export default function SearchView({
  searchTerm,
  searchResults,
  searchLoading,
  conversations,
  onSearchChange,
  onStartDM,
  onJoinChannel,
  onOpenConversation,
  onBack,
}) {
  return (
    <motion.div
      key="search"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="p-4 border-b border-cyan-300/20 bg-cyan-950/10 flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-cyan-100/40 hover:text-cyan-300 transition-colors flex-shrink-0"
        >
          <ArrowLeft size={16} />
        </button>
        <input
          type="text"
          autoFocus
          placeholder="Search users or channels..."
          value={searchTerm}
          onChange={onSearchChange}
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

        {searchResults.users.length > 0 && (
          <div className="space-y-1">
            <div className="text-[8px] uppercase tracking-[0.3em] text-cyan-500/50 px-1 mb-2">Users</div>
            {searchResults.users.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-2 border border-cyan-500/10 bg-cyan-950/20 rounded">
                <span className="text-[11px] text-cyan-50 font-mono">{user.username}</span>
                <button
                  onClick={() => onStartDM(user.id)}
                  className="text-[9px] uppercase tracking-widest text-cyan-400 hover:text-cyan-200 border border-cyan-500/30 hover:border-cyan-400 px-2 py-0.5 rounded transition-all"
                >
                  DM
                </button>
              </div>
            ))}
          </div>
        )}

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
                      onClick={() => onOpenConversation(ch.id)}
                      className="text-[9px] uppercase tracking-widest text-cyan-400 hover:text-cyan-200 border border-cyan-500/30 hover:border-cyan-400 px-2 py-0.5 rounded transition-all"
                    >
                      Open
                    </button>
                  ) : (
                    <button
                      onClick={() => onJoinChannel(ch.id)}
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

        {!searchLoading && searchTerm && searchResults.users.length === 0 && searchResults.channels.length === 0 && (
          <div className="text-[9px] text-cyan-100/30 uppercase tracking-widest text-center mt-8">
            No results
          </div>
        )}

        {!searchTerm && (
          <div className="text-[9px] text-cyan-100/20 uppercase tracking-widest text-center mt-8">
            Type to search
          </div>
        )}
      </div>
    </motion.div>
  );
}
