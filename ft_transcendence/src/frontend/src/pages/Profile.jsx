import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { UserRound, Trophy, Cpu, Pencil, Crown, Zap } from "lucide-react";
import Navbar from "../components/Navbar";
import LightCycles from "../components/LightCycles";
import { getCurrentUser } from "../api/users";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import userimage from "../assets/userimage.png";

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

        setProfile({
          username: data.username,
          wins: Number(data.wins ?? 0),
          matches: Number(data.matches ?? 0),
          score: Number(data.score ?? 0),
          rank: Number(data.rank ?? 0),
        });

        setStatus("success");
      } catch (err) {
        console.error("Profile error:", err);
        setStatus("error");
      }
    };

    fetchUser();
  }, [loading, isAuthenticated]);


  if (loading) {
    return <div className="text-white">Initializing session...</div>;
  }

  if (!isAuthenticated) {
    return <div className="text-white">Not authenticated</div>;
  }

  if (status === "loading" || !profile) {
    return <div className="text-white">Loading profile...</div>;
  }

  if (status === "error") {
    return <div className="text-red-500">Failed to load profile</div>;
  }

 
  return (
    <div className="relative min-h-screen overflow-hidden bg-voidBlack font-mono text-[color:var(--tron-text)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="grid-atmosphere" />
        <div className="grid-floor" />
        <LightCycles />
        <div className="scanline-overlay" />
      </div>

      <Navbar />

      <motion.main className="relative z-20 flex items-center justify-center px-6 py-16">
        <motion.section className="neon-panel w-full max-w-3xl p-10 text-center">
          
          <button className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border-[color:var(--tron-border)] text-cyan-100 hover:bg-cyan-300/10">
            <Pencil size={16} />
          </button>

          <div className="mb-6 flex justify-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-[color:var(--tron-border)]">
              <img
                src={userimage}
                alt="userimage"
                className="h-24 w-24 rounded-full object-cover"
              />
            </div>
          </div>

          <h1 className="neon-title text-4xl uppercase tracking-[0.16em] text-gridBlue">
            {profile.username}
          </h1>

          <p className="mt-4 text-xs uppercase tracking-[0.24em] text-cyan-100/70">
            Grid Competitor
          </p>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">

            <div className="rounded-xl border border-cyan-300/30 p-6">
              <div className="mb-2 flex items-center justify-center gap-2">
                <Trophy size={18} />
                <span className="text-xs uppercase tracking-[0.2em]">Wins</span>
              </div>
              <p className="text-3xl">{profile.wins}</p>
            </div>

            <div className="rounded-xl border border-cyan-300/30 p-6">
              <div className="mb-2 flex items-center justify-center gap-2">
                <Cpu size={18} />
                <span className="text-xs uppercase tracking-[0.2em]">Matches</span>
              </div>
              <p className="text-3xl">{profile.matches}</p>
            </div>

            <div className="rounded-xl border border-cyan-300/30 p-6">
              <div className="mb-2 flex items-center justify-center gap-2">
                <Zap size={18} />
                <span className="text-xs uppercase tracking-[0.2em]">Score</span>
              </div>
              <p className="text-3xl">{profile.score}</p>
            </div>

            <div className="rounded-xl border border-cyan-300/30 p-6">
              <div className="mb-2 flex items-center justify-center gap-2">
                <Crown size={18} />
                <span className="text-xs uppercase tracking-[0.2em]">Rank</span>
              </div>
              <p className="text-3xl">{profile.rank}</p>
            </div>

          </div>
        </motion.section>
      </motion.main>
    </div>
  );
}

