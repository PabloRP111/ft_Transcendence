import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { UserRound, Heart } from "lucide-react";
import aiAvatar from "../assets/ai_profile.jpg";
import TronCanvas from "../components/TronCanvas";
import { useTronBackendMatch } from "../hooks/useTronMatchAPI";

function Lives({ lives, maxLives }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: maxLives }).map((_, i) => (
        <motion.div
          key={i}
          animate={i < lives ? { scale: [1, 1.2, 1] } : {}}
          transition={{ repeat: Infinity, duration: 1.2 }}
        >
          <Heart
            size={22}
            className={
              i < lives
                ? "text-red-500 fill-red-500 drop-shadow-[0_0_10px_red]"
                : "text-red-500 opacity-20"
            }
          />
        </motion.div>
      ))}
    </div>
  );
}

export default function TronDuelArena() {
  const { config, state, matchResult, sendMove, restartMatch } = useTronBackendMatch();
  const engineRef = useRef(state);

  useEffect(() => { engineRef.current = state }, [state]);

  // Keyboard input
  useEffect(() => {
    if (!config || !state)
      return;

    const handleKeyDown = (event) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const nextDirection = config.playerKeymap[key];
      if (!nextDirection) return;
      event.preventDefault();
      sendMove(1, nextDirection);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [config, state, sendMove]);

  if (!config)
    return <div>Loading...</div>;

  const player1 = state?.players[0];
  const player2 = state?.players[1];


  return (
    <div className="relative min-h-screen overflow-hidden bg-voidBlack font-mono text-cyan-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="grid-atmosphere" />
        <div className="grid-floor" />
        <div className="scanline-overlay" />
      </div>

      <main className="relative z-20 flex items-center justify-center gap-16 px-10 py-16">

        {/* PLAYER 1 */}
        <motion.section
          initial={{ x: -200, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.7 }}
          className="flex w-64 flex-col items-center gap-6 rounded-xl border border-cyan-300/30 bg-black/40 p-8 backdrop-blur"
        >
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 1.4 }}
            className="flex h-24 w-24 items-center justify-center rounded-full border border-cyan-300/40 shadow-[0_0_40px_#00f7ff]"
          >
            <UserRound size={50} />
          </motion.div>

          <h2 className="text-xl uppercase tracking-[0.2em] text-gridBlue">
            {player1?.name ?? "Player"}
          </h2>

          <Lives lives={player1?.lives ?? config.startingLives} maxLives={config.startingLives} />

          <p className="text-sm uppercase tracking-[0.2em] text-cyan-100/80">
            Matches Won {state?.matchesWon?.[0] ?? 0}
          </p>
        </motion.section>

        {/* ARENA */}
        <div className="flex flex-col items-center gap-10">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="relative flex h-[720px] w-[1000px] items-center justify-center rounded-xl border border-cyan-300/40 bg-black shadow-[0_0_40px_#00f7ff]"
          >
            <motion.div
              className="absolute inset-0 rounded-xl"
              animate={{
                boxShadow: ["0 0 20px #00f7ff", "0 0 60px #00f7ff", "0 0 20px #00f7ff"],
              }}
              transition={{ repeat: Infinity, duration: 2 }}
            />

            <TronCanvas engineState={state} config={config} />

            {/* Overlays */}
            {matchResult && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="pointer-events-auto absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md border border-cyan-500/30"
              >
                {/* Título del Ganador con clase neon-title */}
                <h2 className="neon-title text-5xl font-bold uppercase tracking-[0.3em] text-cyan-100">
                  {matchResult === "DRAW" ? "DRAW" : `${matchResult} WINS`}
                </h2>

                {/* Contenedor de botones con más margen superior (mt-12) */}
                <div className="flex gap-6 mt-12">
                  <button
                    className="neon-button px-10 py-4 bg-cyan-500/10 hover:bg-cyan-500/30 border border-cyan-400/60 text-cyan-50 transition-all duration-300 uppercase tracking-widest text-sm"
                    onClick={restartMatch}
                  >
                    Restart Match
                  </button>
                  <button
                    className="neon-button px-10 py-4 bg-cyan-500/10 hover:bg-cyan-500/30 border border-cyan-400/60 text-cyan-50 transition-all duration-300 uppercase tracking-widest text-sm"
                    onClick={() => window.location.href = "/"}
                  >
                    Back to Home
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>

          <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/75">
            Controls: WASD or Arrow keys
          </p>
        </div>

        {/* PLAYER 2 (AI) */}
        <motion.section
          initial={{ x: 200, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.7 }}
          className="flex w-64 flex-col items-center gap-6 rounded-xl border border-cyan-300/30 bg-black/40 p-8 backdrop-blur"
        >
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 1.4 }}
            className="flex h-24 w-24 items-center justify-center rounded-full border border-cyan-300/40 shadow-[0_0_40px_#00f7ff]"
          >
            <div className="h-24 w-24 rounded-full overflow-hidden border border-cyan-300/40 shadow-[0_0_40px_#00f7ff]">
              <img
                src={aiAvatar}
                alt="AI Avatar"
                className="h-full w-full object-cover"
              />
            </div>
          </motion.div>

          <h2 className="text-xl uppercase tracking-[0.2em] text-gridBlue">
            {player2?.name ?? "AI_CORE"}
          </h2>

          <Lives lives={player2?.lives ?? config.startingLives} maxLives={config.startingLives} />

          <p className="text-sm uppercase tracking-[0.2em] text-cyan-100/80">
            Matches Won {state?.matchesWon?.[1] ?? 0} 
          </p>
        </motion.section>
      </main>
    </div>
  );
}
