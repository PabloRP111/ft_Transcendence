import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

export default function CreateChannelView({
  newChannelName,
  setNewChannelName,
  newChannelDesc,
  setNewChannelDesc,
  newChannelPublic,
  setNewChannelPublic,
  creating,
  onSubmit,
  onBack,
}) {
  return (
    <motion.div
      key="create"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full"
    >
      <div className="p-4 border-b border-cyan-300/20 bg-cyan-950/10 flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-cyan-100/40 hover:text-cyan-300 transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <span className="text-[10px] uppercase tracking-[0.2em] text-cyan-400">
          Create Channel
        </span>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4 p-4">
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
  );
}
