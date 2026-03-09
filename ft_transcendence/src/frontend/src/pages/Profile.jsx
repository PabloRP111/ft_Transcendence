import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { UserRound, Trophy, Cpu, LogOut, Pencil, Crown, Zap } from "lucide-react";

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
  const [username, setUsername] = useState("PlayerOne");

  useEffect(() => {
    const storedUser = localStorage.getItem("username");
    if (storedUser) setUsername(storedUser);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("transcendence_auth");
    window.location.href = "/";
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-voidBlack font-mono text-cyan-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="grid-atmosphere" />
        <div className="grid-floor" />
        <div className="scanline-overlay" />
      </div>

      <motion.header
        className="sticky top-0 z-30 border-b border-cyan-300/35 bg-[#05080f]/85 backdrop-blur-md"
        initial={{ y: -28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55 }}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
          <span className="neon-title text-xs uppercase tracking-[0.34em] text-cyan-100">
            TRANSCENDENCE PROFILE
          </span>

          <div className="flex items-center gap-3">
            <Link to="/" className="neon-button text-[11px]">
              Back to Grid
            </Link>

            <button
              onClick={handleLogout}
              className="neon-button neon-button-orange text-[11px]"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </motion.header>

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
          <button className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/40 text-cyan-100 hover:bg-cyan-300/10">
            <Pencil size={16} />
          </button>
          <motion.div
            variants={itemVariants}
            className="mb-6 flex justify-center"
          >
            <div className="flex h-24 w-24 items-center justify-center rounded-full border border-cyan-300/40">
              <UserRound size={48} />
            </div>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="neon-title text-4xl uppercase tracking-[0.16em] text-gridBlue"
          >
            {username}
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
              <p className="text-3xl">24</p>
            </div>

            <div className="rounded-xl border border-cyan-300/30 p-6">
              <div className="mb-2 flex items-center justify-center gap-2">
                <Cpu size={18} />
                <span className="text-xs uppercase tracking-[0.2em]">
                  Matches
                </span>
              </div>
              <p className="text-3xl">57</p>
            </div>

            <div className="rounded-xl border border-cyan-300/30 p-6">
              <div className="mb-2 flex items-center justify-center gap-2">
                <Zap size={18} />
                <span className="text-xs uppercase tracking-[0.2em]">
                  Score
                </span>
              </div>
              <p className="text-3xl">200</p>
            </div>

            <div className="rounded-xl border border-cyan-300/30 p-6">
              <div className="mb-2 flex items-center justify-center gap-2">
                <Crown size={18} />
                <span className="text-xs uppercase tracking-[0.2em]">
                  Rank
                </span>
              </div>
              <p className="text-3xl">10</p>
            </div>
          </motion.div>
        </motion.section>
      </motion.main>


    </div>
  );
}

