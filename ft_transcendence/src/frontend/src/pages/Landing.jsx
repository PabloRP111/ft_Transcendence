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

		{/* MODULAR CHAT INJECTION 
          - 'fixed left-0 top-24 bottom-12': Sticks to the left and spans the space between Nav and Footer.
          - 'w-[calc(50vw-384px)]': Calculates the exact empty space to the left of the central panel (768px / 2 = 384px).
          - 'flex items-center justify-center': Centers the ChatModule perfectly within that calculated box.
      */}
      {!loading && isAuthenticated && (
        <aside className="fixed left-0 top-24 bottom-12 z-40 hidden lg:flex items-center justify-center w-[calc(50vw-384px)] px-4">
          <div className="w-full max-w-[320px] h-[60vh] max-h-[550px]">
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

        <motion.h1
          className="landing-tron-title mt-50 sm:mt-52" // mucho más abajo
          initial={{ opacity: 0, y: -20 }}
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
