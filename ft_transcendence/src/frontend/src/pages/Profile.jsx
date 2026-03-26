import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { UserRound, Trophy, Cpu, Pencil, Crown, Zap } from "lucide-react";
import Navbar from "../components/Navbar";
import LightCycles from "../components/LightCycles";
import { getCurrentUser } from "../api/users";
import { useAuth } from "../context/AuthContext";
import userimage from "../assets/userimage.png";

/**
 * ProfilePage — Displays the authenticated user's stats and grid ranking.
 */
export default function ProfilePage() {
  const { loading, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | success | error

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      setProfile(null);
      return;
    }

    const fetchUser = async () => {
      setStatus("loading");
      try {
        const data = await getCurrentUser();

        // Standardizing the user profile data
        setProfile({
          username: data.username,
          wins: Number(data.wins ?? 0),
          matches: Number(data.matches ?? 0),
          score: Number(data.score ?? 0),
          rank: Number(data.rank ?? 0),
        });

        setStatus("success");
      } catch (err) {
        console.error("[profile] fetch error:", err);
        setStatus("error");
      }
    };

    fetchUser();
  }, [loading, isAuthenticated]);

  // ── Authentication & Loading Guards ─────────────────────────────────────────
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-cyan-400 font-mono">INITIALIZING_SESSION...</div>;
  }

  if (!isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center text-red-500 font-mono">ACCESS_DENIED: UNAUTHORIZED</div>;
  }

  if (status === "loading" || !profile) {
    return <div className="flex min-h-screen items-center justify-center text-cyan-400 font-mono">RETRIEVING_USER_DATA...</div>;
  }

  if (status === "error") {
    return <div className="flex min-h-screen items-center justify-center text-red-500 font-mono">DATA_CORRUPTION_ERROR</div>;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-voidBlack font-mono text-[color:var(--tron-text)]">
      
      {/* ── BACKGROUND ATMOSPHERE ── */}
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
          
          {/* Edit Button */}
          <button
            onClick={() => window.location.href = "/edit"}
            className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full border border-cyan-500/30 text-cyan-100 hover:bg-cyan-500/10 transition-colors"      
          >
            <Pencil size={18} />
          </button>

          {/* User Avatar */}
          <div className="mb-6 flex justify-center">
            <div className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-cyan-500/40 shadow-[0_0_20px_rgba(0,247,255,0.3)] overflow-hidden bg-black">
              {userimage ? (
                <img
                  src={userimage}
                  alt="User Profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserRound size={48} className="text-cyan-500" />
              )}
            </div>
          </div>

          <h1 className="neon-title text-4xl uppercase tracking-[0.16em] text-gridBlue">
            {profile.username}
          </h1>

          <p className="mt-4 text-xs uppercase tracking-[0.24em] text-cyan-100/70">
            Grid Competitor
          </p>

          {/* ── STATS GRID ── */}
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