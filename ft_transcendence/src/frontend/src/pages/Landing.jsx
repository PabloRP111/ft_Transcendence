import { motion } from "framer-motion"; //animations
import { Cpu } from "lucide-react"; //icons
import Footer from "../components/Footer.jsx";
import Navbar from "../components/Navbar.jsx";
import LightCycles from "../components/LightCycles";
import ChatModule from "../components/ChatModule.jsx";
import { useAuth } from "../context/AuthContext.jsx";

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

export default function GridLanding() {
	const { isAuthenticated, loading } = useAuth();

return (
    <div className="relative flex flex-col min-h-screen overflow-hidden bg-voidBlack font-mono text-[color:var(--tron-text)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="grid-atmosphere" />
        <div className="grid-floor" />
        <LightCycles />
        <div className="scanline-overlay" />
      </div>
      <Navbar />

      {!loading && isAuthenticated && (
        <aside className="fixed left-0 top-24 bottom-12 z-40 flex items-center justify-center w-80 px-4">
          <div className="w-full h-[60vh] max-h-[550px]">
            <ChatModule />
          </div>
        </aside>
      )}

      <motion.main
        className="relative z-20 flex flex-col flex-1 min-h-[calc(100vh-176px)] items-center justify-start px-4 pt-16 sm:px-6 lg:px-8"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.section
          variants={itemVariants}
          className="neon-panel w-full max-w-3xl p-8 sm:p-10 text-center flex flex-col items-center gap-4"
        >
          <motion.h1
            variants={itemVariants}
            className="neon-title text-5xl sm:text-6xl md:text-6xl uppercase tracking-[0.04em]"
          >
            ENTER THE ARENA
          </motion.h1>

          <motion.div
            variants={itemVariants}
            className="mt-8 flex flex-col items-center gap-4 w-full max-w-xs sm:max-w-sm"
          >
            <button
              onClick={() => window.location.href = "/online-game"}
              className="neon-button w-full py-3 text-lg uppercase tracking-normal flex justify-center"
            >
              ONLINE GAME
            </button>

            <button
              onClick={() => window.location.href = "/ai-game"}
              className="neon-button w-full py-3 text-lg uppercase tracking-normal flex justify-center"
            >
              PLAY VS AI
            </button>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/45 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-cyan-100/85"
          >
            <Cpu size={14} />
            Arena Core Online
          </motion.div>
        </motion.section>

        <motion.h1
          className="landing-tron-title mt-10 sm:mt-28"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.2 }}
        >
          TRON GAME
        </motion.h1>
      </motion.main>
      <Footer />
    </div>
  );
}
