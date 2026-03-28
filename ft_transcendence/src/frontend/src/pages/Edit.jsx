import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Save, ArrowLeft } from "lucide-react";
import Navbar from "../components/Navbar";
import LightCycles from "../components/LightCycles";
import userimage from "../assets/userimage.png";
import { useAuth } from "../context/AuthContext";
import { editUser, getCurrentUser } from "../api/users";

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

export default function EditProfilePage() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const [form, setForm] = useState({ username: "", email: "", password: "" });

  useEffect(() => {
    getCurrentUser()
      .then((data) => setForm((prev) => ({ ...prev, username: data.username, email: data.email })))
      .catch(() => {});
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

 
  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Saving profile:", form);

    try {
      if (accessToken) {
        const currentUser = await editUser(accessToken, form);

        if (currentUser) {
          setForm({
            username: currentUser.username || form.username,
            email: currentUser.email || form.email,
            password: "",
          });

          if (currentUser.username) {
            localStorage.setItem("username", currentUser.username);
          }

          navigate("/profile"); 
        }
      }
    } catch (err) {
      console.error("Failed to update user profile:", err);
    }
  };
  

  return (
    <div className="relative min-h-screen overflow-hidden bg-voidBlack font-mono text-[color:var(--tron-text)]">
      {/* Background */}
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
          className="neon-panel w-full max-w-2xl p-10"
        >
          {/* Back button */}
          <button
            onClick={() => navigate("/profile")}
            className="mb-6 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-100/70 hover:text-cyan-300"
          >
            <ArrowLeft size={16} /> Volver
          </button>

          {/* Avatar */}
          <motion.div
            variants={itemVariants}
            className="mb-8 flex justify-center"
          >
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-[color:var(--tron-border)]">
              <img
                src={userimage}
                alt="userimage"
                className="h-24 w-24 rounded-full object-cover"
              />
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            variants={itemVariants}
            className="neon-title text-center text-3xl uppercase tracking-[0.16em] text-gridBlue"
          >
            Edit Profile
          </motion.h1>

          {/* Form */}
          <motion.form
            variants={itemVariants}
            onSubmit={handleSubmit}
            className="mt-10 flex flex-col gap-6"
          >
            <input
              type="text"
              name="username"
              placeholder="Username"
              value={form.username}
              onChange={handleChange}
              className="w-full rounded-lg border border-cyan-300/30 bg-black/40 p-3 text-sm text-cyan-100 outline-none focus:border-cyan-300"
            />

            <input
              type="email"
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              className="w-full rounded-lg border border-cyan-300/30 bg-black/40 p-3 text-sm text-cyan-100 outline-none focus:border-cyan-300"
            />

            <input
              type="password"
              name="password"
              placeholder="New Password"
              value={form.password}
              onChange={handleChange}
              className="w-full rounded-lg border border-cyan-300/30 bg-black/40 p-3 text-sm text-cyan-100 outline-none focus:border-cyan-300"
            />

            <button
              type="submit"
              className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-cyan-300/40 bg-cyan-300/10 p-3 text-xs uppercase tracking-[0.2em] text-cyan-100 hover:bg-cyan-300/20"
            >
              <Save size={16} /> Save Changes
            </button>
          </motion.form>
        </motion.section>
      </motion.main>
    </div>
  );
}
