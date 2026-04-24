import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Save, ArrowLeft } from "lucide-react";
import Navbar from "../components/Navbar";
import LightCycles from "../components/LightCycles";
import { useAuth } from "../context/AuthContext";
import { editUser, getCurrentUser, getImgById, uploadAvatar } from "../api/users";
import {validateUsername, validateEmail, validatePassword} from "../utils/security.js";

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
  const fileInputRef = useRef(null);
  const avatarUrlRef = useRef(null);

  const [form, setForm] = useState({ username: "", email: "", password: "", avatar: "" });
  const [msg, setMsg] = useState("");
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    let objectUrl = null;
    let isMounted = true;

    getCurrentUser()
      .then((data) => {
        if (!data?.id) return;
        setUserId(data.id);
        setForm((prev) => ({
          ...prev,
          username: data.username,
          email: data.email
        }));
        return getImgById(data.id);
      })
      .then((blob) => {
        if (!blob || !isMounted) return;
        if (avatarUrlRef.current) URL.revokeObjectURL(avatarUrlRef.current);
        objectUrl = URL.createObjectURL(blob);
        avatarUrlRef.current = objectUrl;
        setForm((prev) => ({ ...prev, avatar: objectUrl }));
      })
      .catch(() => {});

    return () => {
      isMounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (msg)
      setMsg("");
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!userId) return;
    if (!/(image\/jpeg|image\/png)/.test(file.type)) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Avatar must be 2 MB or less.");
      e.target.value = "";
      return;
    }

    if (avatarUrlRef.current) URL.revokeObjectURL(avatarUrlRef.current);
    const previewUrl = URL.createObjectURL(file);
    avatarUrlRef.current = previewUrl;
    setForm((prev) => ({ ...prev, avatar: previewUrl }));

    uploadAvatar(userId, file)
      .then(() => getImgById(userId))
      .then((blob) => {
        if (!blob) return;
        if (avatarUrlRef.current) URL.revokeObjectURL(avatarUrlRef.current);
        const freshUrl = URL.createObjectURL(blob);
        avatarUrlRef.current = freshUrl;
        setForm((prev) => ({ ...prev, avatar: freshUrl }));
      })
      .catch(() => {});
    e.target.value = "";
  };

 
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");

    const username = form.username.trim();
    const email = form.email.trim();
    if (!username || !email) {
      setMsg("Username and email are required");
      return;
    }
    const userVal = validateUsername(username);
    if (!userVal.isValid)
      return setMsg(userVal.error);
    const emailVal = validateEmail(email);
    if (!emailVal.isValid)
      return setMsg(emailVal.error);
    if (form.password) {
      const passVal = validatePassword(form.password);
      if (!passVal.isValid)
        return setMsg(passVal.error);
    }

    try {
      if (!accessToken)
        return;

      const payload = {
        username,
        email,
        password: form.password || undefined,
        avatar: form.avatar,
      };

      const currentUser = await editUser(accessToken, payload);
      if (currentUser) {
        setMsg("");
        setForm({
          username: currentUser.username || username,
          email: currentUser.email || email,
          password: "",
          avatar: form.avatar,
        });
        localStorage.setItem("username", currentUser.username);
        navigate("/profile");
      }
    } catch (err) {
      setMsg("Update failed: " + err.message);
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
              {form.avatar ? (
                <img
                  src={form.avatar}
                  alt="avatar"
                  onClick={handleAvatarClick}
                  className="h-24 w-24 rounded-full object-cover"
                />
              ) : null}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              hidden
            />
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
            {msg && (
              <p className="mt-4 text-xs uppercase tracking-[0.2em] text-cyan-100/70">
                {msg}
              </p>
            )}
          </motion.form>
        </motion.section>
      </motion.main>
    </div>
  );
}
