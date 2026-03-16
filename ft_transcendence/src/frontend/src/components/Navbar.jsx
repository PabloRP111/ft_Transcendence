import { motion } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogIn, UserPlus, UserRoundCog } from "lucide-react";
import Button from "./Button.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const glitchHover = {
  x: [0, -2, 2, -1, 0],
  textShadow: [
    "0 0 6px rgba(0, 242, 255, 0.8)",
    "-2px 0 0 rgba(255, 140, 0, 0.8), 2px 0 0 rgba(0, 242, 255, 0.9)",
    "2px 0 0 rgba(255, 140, 0.8), -2px 0 0 rgba(0, 242, 255, 0.9)",
    "-1px 0 0 rgba(255, 140, 0.7), 1px 0 0 rgba(0, 242, 255, 0.95)",
    "0 0 14px rgba(0, 242, 255, 1)",
  ],
  transition: {
    duration: 0.42,
    times: [0, 0.18, 0.45, 0.72, 1],
  },
};

export default function Navbar() {
  const { isAuthenticated, logoutUser, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logoutUser();
    navigate("/");
  };

  if (loading) return null;

  return (
    <motion.header
      className="sticky top-0 z-30 border-b border-cyan-300/35 bg-[#05080f]/85 backdrop-blur-md"
      initial={{ y: -28, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        {/* Título clickeable */}
        <motion.span
          className="neon-title text-xs uppercase tracking-[0.34em] text-cyan-100 sm:text-sm md:text-base cursor-pointer"
          whileHover={glitchHover}
          onClick={() => navigate("/")}
        >
          TRANSCENDENCE
        </motion.span>

        <div className="flex items-center gap-2 sm:gap-3">

          {isAuthenticated ? (
            <>
              {/* Oculta botón de perfil si ya estamos en /profile */}
              {location.pathname !== "/profile" && (
                <Button
                  to="/profile"
                  className="text-[10px] sm:text-[11px]"
                  icon={<UserRoundCog size={16} />}
                >
                  User Profile
                </Button>
              )}

              <button
                onClick={handleLogout}
                className="neon-button text-[10px] sm:text-[11px]"
              >
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
                Login
              </Button>
              <Button
                to="/register"
                variant="orange"
                className="text-[10px] sm:text-[11px]"
                icon={<UserPlus size={16} />}
              >
                Register
              </Button>
            </>
          )}
        </div>
      </div>
    </motion.header>
  );
}