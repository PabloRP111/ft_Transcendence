import { motion } from "framer-motion";
import { UserRound } from "lucide-react";

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

  const players = [
    { id: 1, name: "prosas-p" },
    { id: 2, name: "aamoros-" },
    { id: 3, name: "mzuloaga" },
    { id: 4, name: "femoreno" },
    { id: 5, name: "jotrujil" }
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-voidBlack font-mono text-cyan-50">

      {/* TRON background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="grid-atmosphere" />
        <div className="grid-floor" />
        <div className="scanline-overlay" />
      </div>

      <motion.main
        className="relative z-20 flex min-h-screen items-center justify-center px-10"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >

        <div className="flex flex-col items-center gap-16">

          {/* TITLE */}
          <motion.h1
            variants={itemVariants}
            className="neon-title text-4xl tracking-[0.2em] text-gridBlue text-center"
          >
            Creditos
          </motion.h1>

          {/* PLAYERS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-12">

            {players.map(player => (

              <motion.div
                key={player.id}
                variants={itemVariants}
                className="flex flex-col items-center gap-4 rounded-xl border border-cyan-300/30 bg-black/40 p-8 backdrop-blur text-center shadow-[0_0_20px_#00f7ff]"
              >

                {/* Avatar */}
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="flex h-20 w-20 items-center justify-center rounded-full border border-cyan-300/40 shadow-[0_0_30px_#00f7ff]"
                >
                  <UserRound size={40} />
                </motion.div>

                {/* Username */}
                <h2 className="text-sm tracking-[0.18em] text-gridBlue">
                  {player.name}
                </h2>

              </motion.div>

            ))}

          </div>

        </div>

      </motion.main>

    </div>
  );
}