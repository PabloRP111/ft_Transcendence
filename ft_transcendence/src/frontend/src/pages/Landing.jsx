import { motion } from "framer-motion"; //animations
import { Cpu } from "lucide-react"; //icons
import Footer from "../components/Footer.jsx";
import Navbar from "../components/Navbar.jsx";

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
  return (
    <div className="relative flex flex-col min-h-screen overflow-hidden bg-voidBlack font-mono text-cyan-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="grid-atmosphere" />
        <div className="grid-floor" />
        <div className="scanline-overlay" />
      </div>

      <Navbar />

      <motion.main
        className="relative z-20 flex flex-1 min-h-[calc(100vh-176px)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8"
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

      <Footer />
    </div>
  );
}
