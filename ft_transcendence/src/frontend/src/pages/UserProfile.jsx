import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { UserRound, Trophy, Cpu, Crown, Zap, ArrowLeft, MessageSquare } from "lucide-react";
import Navbar from "../components/Navbar";
import LightCycles from "../components/LightCycles";
import { getUserById, getUserByUsername } from "../api/users";
import { usePresence } from "../context/PresenceContext";
import userimage from "../assets/userimage.png";

export default function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const onlineUsers = usePresence();

  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    // Support both /profile/42 (numeric ID) and /profile/username
    const fetch = /^\d+$/.test(id) ? getUserById(id) : getUserByUsername(id);
    fetch
      .then((data) => {
        setProfile({
          id: data.id,
          username: data.username,
          wins: Number(data.wins ?? 0),
          matches: Number(data.matches ?? 0),
          score: Number(data.score ?? 0),
          rank: Number(data.rank ?? 0),
        });
        setStatus("success");
      })
      .catch(() => setStatus("error"));
  }, [id]);

  const isOnline = profile ? onlineUsers.has(String(profile.id)) : false;

  if (status === "loading")
    return <div className="flex min-h-screen items-center justify-center text-cyan-400 font-mono">RETRIEVING_USER_DATA...</div>;

  if (status === "error")
    return <div className="flex min-h-screen items-center justify-center text-red-500 font-mono">USER_NOT_FOUND</div>;

  return (
    <div className="relative min-h-screen overflow-hidden bg-voidBlack font-mono text-[color:var(--tron-text)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="grid-atmosphere" />
        <div className="grid-floor" />
        <LightCycles />
        <div className="scanline-overlay" />
      </div>

      <Navbar />

      <motion.main
        className="relative z-20 flex items-center justify-center px-6 py-16"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.section className="neon-panel relative w-full max-w-3xl p-10 text-center">

          {/* Back button */}
          <button
            onClick={() => navigate(-1)}
            className="absolute left-6 top-6 flex h-10 w-10 items-center justify-center rounded-full border border-cyan-500/30 text-cyan-100 hover:bg-cyan-500/10 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>

          {/* Avatar */}
          <div className="mb-6 flex justify-center">
            <div className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-cyan-500/40 shadow-[0_0_20px_rgba(0,247,255,0.3)] overflow-hidden bg-black">
              <img src={userimage} alt="User Profile" className="h-full w-full object-cover" />
            </div>
          </div>

          <h1 className="neon-title text-4xl uppercase tracking-[0.16em] text-gridBlue">
            {profile.username}
          </h1>

          {/* Online indicator */}
          <p className={`mt-2 text-xs flex items-center justify-center gap-1.5 ${isOnline ? "text-green-400" : "text-cyan-100/40"}`}>
            <span className={`w-1.5 h-1.5 rounded-full inline-block ${isOnline ? "bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.8)]" : "bg-gray-600"}`} />
            {isOnline ? "online" : "offline"}
          </p>

          <p className="mt-2 text-xs uppercase tracking-[0.24em] text-cyan-100/70">
            Grid Competitor
          </p>

          {/* Action buttons */}
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => navigate(`/?dm=${profile.id}`)}
              className="flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs uppercase tracking-widest text-cyan-300 hover:bg-cyan-500/20 transition-colors"
            >
              <MessageSquare size={14} /> DM
            </button>
          </div>

          {/* Stats */}
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-cyan-300/30 bg-cyan-950/10 p-6 backdrop-blur-sm transition-transform hover:scale-105">
              <div className="mb-2 flex items-center justify-center gap-2 text-cyan-400">
                <Trophy size={18} />
                <span className="text-xs uppercase tracking-[0.2em]">Wins</span>
              </div>
              <p className="text-3xl font-bold">{profile.wins}</p>
            </div>

            <div className="rounded-xl border border-cyan-300/30 bg-cyan-950/10 p-6 backdrop-blur-sm transition-transform hover:scale-105">
              <div className="mb-2 flex items-center justify-center gap-2 text-cyan-400">
                <Cpu size={18} />
                <span className="text-xs uppercase tracking-[0.2em]">Matches</span>
              </div>
              <p className="text-3xl font-bold">{profile.matches}</p>
            </div>

            <div className="rounded-xl border border-cyan-300/30 bg-cyan-950/10 p-6 backdrop-blur-sm transition-transform hover:scale-105">
              <div className="mb-2 flex items-center justify-center gap-2 text-cyan-400">
                <Zap size={18} />
                <span className="text-xs uppercase tracking-[0.2em]">Score</span>
              </div>
              <p className="text-3xl font-bold">{profile.score}</p>
            </div>

            <div className="rounded-xl border border-cyan-300/30 bg-cyan-950/10 p-6 backdrop-blur-sm transition-transform hover:scale-105">
              <div className="mb-2 flex items-center justify-center gap-2 text-cyan-400">
                <Crown size={18} />
                <span className="text-xs uppercase tracking-[0.2em]">Rank</span>
              </div>
              <p className="text-3xl font-bold">#{profile.rank}</p>
            </div>
          </div>

        </motion.section>
      </motion.main>
    </div>
  );
}
