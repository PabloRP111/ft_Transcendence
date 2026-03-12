import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { UserPlus, LogIn } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { register } from "../api/auth.js";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.16, delayChildren: 0.18 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await register({ email, username, password });
      if (res.error) {
        setMsg(res.error);
        return;
      }
      setMsg("Registration successful! You can now login.");
      // Opcional: redirigir al login automáticamente
      // navigate("/login");
    } catch (err) {
      setMsg("Fetch failed: " + err.message);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-voidBlack font-mono text-cyan-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="grid-atmosphere" />
        <div className="grid-floor" />
        <div className="scanline-overlay" />
      </div>

      <Navbar />

      <motion.main
        className="relative z-20 flex flex-1 items-center justify-center px-6 py-16"
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
            CREATE ACCOUNT
          </motion.h1>

          <motion.form
            variants={itemVariants}
            className="flex flex-col gap-4"
            onSubmit={handleRegister}
          >
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-[#05070d]/70 border border-cyan-300/40 rounded-md p-3 text-cyan-50 placeholder-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-300"
            />
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
              <UserPlus size={16} />
              Register
            </button>
          </motion.form>

          <motion.div
            variants={itemVariants}
            className="mt-6 flex justify-center gap-4"
          >
            <button
              onClick={() => navigate("/login")}
              className="neon-button-orange flex items-center gap-2"
            >
              <LogIn size={16} />
              Go to Login
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

      <Footer />
    </div>
  );
}