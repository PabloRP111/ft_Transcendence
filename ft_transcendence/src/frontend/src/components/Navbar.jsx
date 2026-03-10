import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LogIn, UserPlus, UserRoundCog } from "lucide-react";
import Button from "./Button.jsx";
import { logout } from "../api/auth.js";
import { useNavigate } from "react-router-dom";

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

export default function Navbar() {
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

  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      localStorage.removeItem("accessToken");
      localStorage.removeItem("transcendence_auth");
      setIsLoggedIn(false);
      navigate("/");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
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
            <>
              <Button
                to="/profile"
                className="neon-profile-pulse text-[10px] sm:text-[11px]"
                icon={<UserRoundCog size={16} />}>
                User Profile
              </Button>

              <button
                onClick={handleLogout}
                className="neon-button text-[10px] sm:text-[11px]">
                Logout
              </button>
            </>
          ) : (
            <>
              <Button
                to="/login"
                className="text-[10px] sm:text-[11px]"
                icon={<LogIn size={16} />}
              >
                System Access
              </Button>
              <Button
                to="/register"
                variant="orange"
                className="text-[10px] sm:text-[11px]"
                icon={<UserPlus size={16} />}
              >
                Identity Sync
              </Button>
            </>
          )}
        </div>
      </div>
    </motion.header>
  );
}
