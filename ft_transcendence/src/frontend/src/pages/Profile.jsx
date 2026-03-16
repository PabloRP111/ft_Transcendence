import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { UserRound, Trophy, Cpu, Pencil, Crown, Zap } from "lucide-react";
import Navbar from "../components/Navbar";
import LightCycles from "../components/LightCycles";
import { getCurrentUser } from "../api/users";
import { useAuth } from "../context/AuthContext";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.16,
      delayChildren: 0.18,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: "easeOut",
    },
  },
};

export default function ProfilePage() {
  const { accessToken, loading } = useAuth();
  const [profile, setProfile] = useState({
    username: "",
    wins: 0,
    matches: 0,
    score: 0,
    rank: 0,
  });

  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (loading) {
        return;
      }

      try {
        if (accessToken) {
          const currentUser = await getCurrentUser(accessToken);
          if (currentUser && currentUser.username) {
            setProfile({
              username: currentUser.username,
              wins: Number(currentUser.wins ?? 0),
              matches: Number(currentUser.matches ?? 0),
              score: Number(currentUser.score ?? 0),
              rank: Number(currentUser.rank ?? 0),
            });
            localStorage.setItem("username", currentUser.username);
            return;
          }
        }

        const storedUser = localStorage.getItem("username");
        if (storedUser) {
          setProfile((prev) => ({ ...prev, username: storedUser }));
        }
      } catch (err) {
        console.error("Failed to fetch current user profile:", err);
        const storedUser = localStorage.getItem("username");
        if (storedUser) {
          setProfile((prev) => ({ ...prev, username: storedUser }));
        }
      }
    };

    fetchCurrentUser();
  }, [accessToken, loading]);

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
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.section
          variants={itemVariants}
          className="neon-panel w-full max-w-3xl p-10 text-center"
        >
          <button className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border-[color:var(--tron-border)] text-cyan-100 hover:bg-cyan-300/10">
            <Pencil size={16} />
          </button>
          <motion.div
            variants={itemVariants}
            className="mb-6 flex justify-center"
          >
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-[color:var(--tron-border)]">
              <UserRound size={48} />
            </div>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="neon-title text-4xl uppercase tracking-[0.16em] text-gridBlue"
          >
            {profile.username || "UNKNOWN USER"}
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="mt-4 text-xs uppercase tracking-[0.24em] text-cyan-100/70"
          >
            Grid Competitor
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2"
          >
            <div className="rounded-xl border border-cyan-300/30 p-6">
              <div className="mb-2 flex items-center justify-center gap-2">
                <Trophy size={18} />
                <span className="text-xs uppercase tracking-[0.2em]">
                  Wins
                </span>
              </div>
              <p className="text-3xl">{profile.wins}</p>
            </div>

            <div className="rounded-xl border border-cyan-300/30 p-6">
              <div className="mb-2 flex items-center justify-center gap-2">
                <Cpu size={18} />
                <span className="text-xs uppercase tracking-[0.2em]">
                  Matches
                </span>
              </div>
              <p className="text-3xl">{profile.matches}</p>
            </div>

            <div className="rounded-xl border border-cyan-300/30 p-6">
              <div className="mb-2 flex items-center justify-center gap-2">
                <Zap size={18} />
                <span className="text-xs uppercase tracking-[0.2em]">
                  Score
                </span>
              </div>
              <p className="text-3xl">{profile.score}</p>
            </div>

            <div className="rounded-xl border border-cyan-300/30 p-6">
              <div className="mb-2 flex items-center justify-center gap-2">
                <Crown size={18} />
                <span className="text-xs uppercase tracking-[0.2em]">
                  Rank
                </span>
              </div>
              <p className="text-3xl">{profile.rank}</p>
            </div>
          </motion.div>
        </motion.section>
      </motion.main>


    </div>
  );
}

