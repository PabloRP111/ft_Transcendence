import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { UserRound } from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import LightCycles from "../components/LightCycles";

// Import core assets
import prosas from "../assets/credits/prosas.png";
import aamoros from "../assets/credits/aamoros.png";
import mzuloaga from "../assets/credits/mzuloaga.png";
import femoreno from "../assets/credits/femoreno.png";
import jotrujil from "../assets/credits/jotrujil.png";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 25 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 }
  }
};

export default function CreditsPage() {
  const navigate = useNavigate();

  const players = [
    { id: 1, name: "prosas-p", rol: "Product Owner", avatar: prosas },
    { id: 2, name: "aamoros-", rol: "Project Manager", avatar: aamoros },
    { id: 3, name: "mzuloaga", rol: "Technical Lead", avatar: mzuloaga },
    { id: 4, name: "femoreno", rol: "Developer", avatar: femoreno },
    { id: 5, name: "jotrujil", rol: "Developer", avatar: jotrujil }
  ];

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-voidBlack font-mono text-cyan-50">

      {/* TRON Background Atmosphere */}
      <div className="pointer-events-none absolute inset-0">
        <div className="grid-atmosphere" />
        <div className="grid-floor" />
        <LightCycles />
        <div className="scanline-overlay" />
      </div>

      <Navbar />

      <motion.main
        className="relative z-20 flex flex-1 items-center justify-center px-10"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <div className="flex flex-col items-center gap-16">
          <motion.h1
            variants={itemVariants}
            className="neon-title -mt-6 text-5xl sm:text-6xl md:text-6xl uppercase tracking-[0.04em] text-center"
            style={{
              textShadow:
                "0 0 8px rgba(250, 204, 21, 0.82), 0 0 22px rgba(250, 204, 21, 0.42)",
            }}
          >
            CREDITS
          </motion.h1>

          {/* TEAM GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-12">
            {players.map(player => (
              <motion.button
                key={player.id}
                variants={itemVariants}
                type="button"
                onClick={() => navigate(`/profile/${player.name}`)}
                className="flex flex-col items-center gap-4 rounded-xl border border-cyan-300/30 bg-black/40 p-8 text-center shadow-[0_0_20px_rgba(250,204,21,0.72)] backdrop-blur transition-colors hover:border-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
              >
                {/* Floating Avatar */}
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="flex h-20 w-20 items-center justify-center rounded-full border border-cyan-300/40 shadow-[0_0_30px_rgba(250,204,21,0.72)] overflow-hidden bg-cyan-950/30"
                >
                  {player.avatar ? (
                    <img
                      src={player.avatar}
                      alt={player.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserRound size={40} className="text-cyan-500" />
                  )}
                </motion.div>

                {/* Info Block */}
                <div className="space-y-1">
                  <h2 className="text-sm tracking-[0.18em] text-yellow-200 font-bold uppercase">
                    {player.name}
                  </h2>
                  <p className="text-[10px] tracking-[0.1em] text-yellow-300/80 uppercase italic">
                    {player.rol}
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.main>
    </div>
  );
}