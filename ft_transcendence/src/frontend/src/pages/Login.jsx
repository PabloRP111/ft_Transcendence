import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogIn, UserPlus, LogOut } from "lucide-react";
import { login, logout } from "../api/auth.js";
import { useAuth } from "../context/AuthContext.jsx";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.16, delayChildren: 0.18 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { loginUser, logoutUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setMsg("");

    try {
      const data = await login({ email, password });

      if (data.error) {
        setMsg(data.error);
        return;
      }

      loginUser(data.accessToken);
      navigate("/");

    } catch (err) {
      setMsg("Fetch failed: " + err.message);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-voidBlack font-mono text-cyan-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="grid-atmosphere" />
        <div className="grid-floor" />
        <div className="scanline-overlay" />
      </div>

      <motion.main
        className="relative z-20 flex items-center justify-center px-6 py-16"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.section
          variants={itemVariants}
          className="neon-panel w-full max-w-md p-10 text-center"
        >
          <motion.h1
            variants={itemVariants}
            className="neon-title text-4xl uppercase tracking-[0.16em] text-gridBlue mb-6"
          >
            SYSTEM ACCESS
          </motion.h1>

          <motion.form
            variants={itemVariants}
            className="flex flex-col gap-4"
            onSubmit={handleLogin}
          >
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-[#05070d]/70 border border-cyan-300/40 rounded-md p-3 text-cyan-50 placeholder-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-300"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-[#05070d]/70 border border-cyan-300/40 rounded-md p-3 text-cyan-50 placeholder-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-300"
            />

            <button
              type="submit"
              className="neon-button flex items-center justify-center gap-2 mt-2"
            >
              <LogIn size={16} />
              Login
            </button>
          </motion.form>

          <motion.div
            variants={itemVariants}
            className="mt-8 flex justify-center gap-4"
          >
            <button
              onClick={() => navigate("/register")}
              className="neon-button-orange flex items-center gap-2"
            >
              <UserPlus size={20} />
              Register
            </button>
          </motion.div>

          {msg && (
            <motion.p
              variants={itemVariants}
              className="mt-4 text-xs uppercase tracking-[0.2em] text-cyan-100/70"
            >
              {msg}
            </motion.p>
          )}
        </motion.section>
      </motion.main>
    </div>
  );
}