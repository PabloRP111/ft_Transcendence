import { useEffect, useState } from "react";
import { motion } from "framer-motion"; //animations
import { Link } from "react-router-dom";
import {
  Cpu,
  LogIn,
  ShieldCheck,
  ShieldEllipsis,
  UserPlus,
  UserRoundCog,
} from "lucide-react"; //icons 

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

const glitchHover = {
  x: [0, -2, 2, -1, 0],
  textShadow: [
    "0 0 6px rgba(0, 242, 255, 0.8)",
    "-2px 0 0 rgba(255, 140, 0, 0.8), 2px 0 0 rgba(0, 242, 255, 0.9)",
    "2px 0 0 rgba(255, 140, 0, 0.8), -2px 0 0 rgba(0, 242, 255, 0.9)",
    "-1px 0 0 rgba(255, 140, 0, 0.7), 1px 0 0 rgba(0, 242, 255, 0.95)",
    "0 0 14px rgba(0, 242, 255, 1)",
  ],
  transition: {
    duration: 0.42,
    times: [0, 0.18, 0.45, 0.72, 1],
  },
};

export default function GridLanding() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const syncSession = () => {
      setIsLoggedIn(
        localStorage.getItem("transcendence_auth") === "1" ||
          Boolean(localStorage.getItem("accessToken")),
      );
    };

    syncSession();
    window.addEventListener("storage", syncSession);
    window.addEventListener("focus", syncSession);

    return () => {
      window.removeEventListener("storage", syncSession);
      window.removeEventListener("focus", syncSession);
    };
  }, []);

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
        transition={{ duration: 0.55, ease: "easeOut" }}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <motion.span
            className="neon-title text-xs uppercase tracking-[0.34em] text-cyan-100 sm:text-sm md:text-base"
            whileHover={glitchHover}
          >
            TRANSCENDENCE v21
          </motion.span>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden text-[10px] uppercase tracking-[0.34em] text-cyan-100/70 lg:block">
              USER SYSTEM
            </span>

            {isLoggedIn ? (
              <Link
                to="/profile"
                className="neon-button neon-profile-pulse text-[10px] sm:text-[11px]"
              >
                <UserRoundCog size={16} />
                User Profile
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="neon-button text-[10px] sm:text-[11px]"
                >
                  <LogIn size={16} />
                  System Access
                </Link>
                <Link
                  to="/register"
                  className="neon-button neon-button-orange text-[10px] sm:text-[11px]"
                >
                  <UserPlus size={16} />
                  Identity Sync
                </Link>
              </>
            )}
          </div>
        </div>
      </motion.header>

      <motion.main
        className="relative z-20 flex min-h-[calc(100vh-176px)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.section
          variants={itemVariants}
          className="neon-panel w-full max-w-3xl p-8 text-center sm:p-12"
        >
          <motion.p
            variants={itemVariants}
            className="mb-5 text-[10px] uppercase tracking-[0.38em] text-cyan-100/80 sm:text-[11px]"
          >
            The Grid // Boot Sequence
          </motion.p>

          <motion.h1
            variants={itemVariants}
            className="neon-title text-4xl uppercase tracking-[0.16em] text-gridBlue sm:text-5xl md:text-6xl"
          >
            ENTER THE ARENA.
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="mt-6 text-xs uppercase tracking-[0.24em] text-cyan-100/80 sm:text-sm md:text-base"
          >
            Awaiting Light Cycle Initialization...
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="mt-10 inline-flex items-center gap-2 rounded-full border border-cyan-300/45 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-cyan-100/85"
          >
            <Cpu size={14} />
            Arena Core Online
          </motion.div>
        </motion.section>
      </motion.main>

      <footer className="relative z-20 border-t border-cyan-300/30 bg-[#05070d]/80 px-4 py-5 backdrop-blur-sm sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-100/60">
            System Sub-Routines
          </p>

          <nav className="flex items-center gap-4 sm:gap-5">
            <a href="#terms" className="subroutine-link">
              <ShieldCheck size={14} />
              Terms &amp; Conditions
            </a>
            <a href="#privacy" className="subroutine-link">
              <ShieldEllipsis size={14} />
              Privacy Policy
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
