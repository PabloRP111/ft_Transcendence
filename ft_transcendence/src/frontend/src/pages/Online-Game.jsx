import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { UserRound, Heart, Globe, Search } from "lucide-react";
import TronCanvas from "../components/TronCanvas";
import { useTronPvP } from "../hooks/useTronPvP";
import Navbar from "../components/Navbar";
import { findMatch } from "../api/game";

function MatchmakingLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-voidBlack relative">
      <div className="absolute inset-0 flex items-center justify-center opacity-20">
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, opacity: 0.5 }}
            animate={{ scale: 4, opacity: 0 }}
            transition={{ repeat: Infinity, duration: 3, delay: i }}
            className="absolute h-64 w-64 rounded-full border border-cyan-500"
          />
        ))}
      </div>

      <motion.div className="relative z-10 flex flex-col items-center gap-8">
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
            className="p-8 rounded-full border-2 border-dashed border-cyan-500/50"
          >
            <Search size={48} className="text-cyan-400" />
          </motion.div>
        </div>

        <h2 className="text-2xl font-black tracking-[0.5em] text-cyan-400 uppercase">
          Searching for Opponent
        </h2>
      </motion.div>
    </div>
  );
}

function Lives({ lives, maxLives }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: maxLives || 3 }).map((_, i) => (
        <Heart
          key={i}
          size={22}
          className={
            i < lives
              ? "text-red-500 fill-red-500"
              : "text-red-500 opacity-20"
          }
        />
      ))}
    </div>
  );
}

export default function TronPvpArena() {
  const [matchId, setMatchId] = useState(null);
  const { config, state, matchResult, sendMove } = useTronPvP(matchId);

  const ready = state?.status === "playing";

  // MATCHMAKING
  useEffect(() => {
    async function initMatchmaking() {
      try {
        const res = await findMatch();
        setMatchId(res.matchId);
      } catch (err) {
        console.error("matchmaking failed", err);
      }
    }

    initMatchmaking();
  }, []);

  // INPUT
  useEffect(() => {
    if (!config || !state || state.status !== "playing") return;

    const handleKeyDown = (event) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const nextDirection = config.playerKeymap[key];
      if (!nextDirection) return;

      event.preventDefault();
      sendMove(nextDirection);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [config, state, sendMove]);

  const isLoading =
    !matchId ||
    !state ||
    state.status !== "playing";

  return (
    <div className="relative min-h-screen overflow-hidden bg-voidBlack font-mono text-cyan-50">
      <AnimatePresence mode="wait">
        {isLoading || !ready ? (
          <motion.div 
            key="loader"
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.5 }}
          >
            <Navbar />
            <MatchmakingLoader />
          </motion.div>
        ) : (
          <motion.div
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative"
          >
            {/* Background Effects */}
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
                className="flex w-64 flex-col items-center gap-6 rounded-xl border border-cyan-300/30 bg-black/40 p-8 backdrop-blur"
              >
                <div className="relative">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border border-cyan-300/40 shadow-[0_0_40px_#00f7ff]">
                    <UserRound size={50} className="text-cyan-400" />
                  </div>
                  <div className="absolute -bottom-2 right-0 rounded bg-cyan-500 px-2 py-0.5 text-[10px] font-bold text-black">P1</div>
                </div>
                <h2 className="text-xl uppercase tracking-[0.2em] text-cyan-300">{state.players[0]?.name || "Player 1"}</h2>
                <Lives lives={state.players[0]?.lives} maxLives={config.startingLives} />
                <p className="text-sm uppercase tracking-widest text-cyan-100/60">Wins: {state.matchesWon?.[0] || 0}</p>
              </motion.section>

              {/* ARENA */}
              <div className="flex flex-col items-center gap-10">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="relative flex h-[720px] w-[1000px] items-center justify-center rounded-xl border border-cyan-300/40 bg-black shadow-[0_0_40px_#00f7ff]"
                >
                  {!state?.board && (
                    <div className="text-red-500 text-xl">
                      NO BOARD DATA
                    </div>
                  )}
                  {state?.board && (
                    <TronCanvas engineState={state} config={config} />
                  )}
                  {matchResult && (
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl"
                    >
                      <h2 className="text-6xl font-black uppercase tracking-tighter text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]">
                        {matchResult === "DRAW" ? "CONNECTION STALEMATE" : `${matchResult} DOMINATES`}
                      </h2>
                      <button
                        className="mt-12 border-2 border-cyan-500 px-12 py-4 text-cyan-400 hover:bg-cyan-500 hover:text-black transition-all"
                        onClick={() => window.location.reload()}
                      >
                        REMATCH
                      </button>
                    </motion.div>
                  )}
                </motion.div>
                <div className="flex items-center gap-4 text-xs uppercase tracking-[0.3em] text-cyan-100/50">
                  <Globe size={14} className="animate-pulse" />
                  <span>PVP Server: Global Region // Room: {matchId}</span>
                </div>
              </div>

              {/* PLAYER 2 */}
              <motion.section
                initial={{ x: 200, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="flex w-64 flex-col items-center gap-6 rounded-xl border border-pink-500/30 bg-black/40 p-8 backdrop-blur"
              >
                <div className="relative">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border border-pink-500/40 shadow-[0_0_40px_#ff007f]">
                    <UserRound size={50} className="text-pink-500" />
                  </div>
                  <div className="absolute -bottom-2 left-0 rounded bg-pink-500 px-2 py-0.5 text-[10px] font-bold text-black">P2</div>
                </div>
                <h2 className="text-xl uppercase tracking-[0.2em] text-pink-500">{state.players[1]?.name || "Waiting..."}</h2>
                <Lives lives={state.players[1]?.lives} maxLives={config.startingLives} />
                <p className="text-sm uppercase tracking-widest text-pink-100/60">Wins: {state.matchesWon?.[1] || 0}</p>
              </motion.section>
            </main>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

}
