import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { UserRound, Heart, Globe, Search } from "lucide-react";
import TronCanvas from "../components/TronCanvas";
import { useTronPvP } from "../hooks/useTronPvP";
import Navbar from "../components/Navbar";
import { findMatch } from "../api/game";
import { createConversation, postSystemMessage } from "../api/chat";
import { decodeToken, getStoredToken } from "../utils/auth";
import { getImgById } from "../api/users";

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
            className="absolute h-32 w-32 rounded-full border border-cyan-500"
          />
        ))}
      </div>

      <motion.div className="relative z-10 flex flex-col items-center gap-5">
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
            className="p-5 rounded-full border-2 border-dashed border-cyan-500/50"
          >
            <Search size={28} className="text-cyan-400" />
          </motion.div>
        </div>

        <h2 className="text-sm font-black tracking-[0.25em] text-cyan-400 uppercase text-center px-4">
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
  const location = useLocation();
  const [avatars, setAvatars] = useState({});
  const [matchId, setMatchId] = useState(
    location.state?.matchId ?? localStorage.getItem("activeMatch")
  );
  const { config, state, matchResult, sendMove, invalidMatch } = useTronPvP(matchId);
  const isInviteGame = !!location.state?.matchId;
  const [remainingTime, setRemainingTime] = useState(null);
  
  useEffect(() => {
    if (state?.matchOver) {
      localStorage.removeItem("activeMatch");
    }
  }, [state?.matchOver]);

  useEffect(() => {
    const incoming = location.state?.matchId;
    if (incoming && incoming !== matchId) {
      setMatchId(incoming);
    }
  }, [location.state?.matchId]);

  useEffect(() => {
    if (invalidMatch) {
      setMatchId(null);
    }
  }, [invalidMatch]);

  const ready = state?.matchOver || state?.status === "playing" || state?.status === "paused";

  // MATCHMAKING
  useEffect(() => {
    if (matchId) return;

    async function initMatchmaking() {
      try {
        const res = await findMatch();
        setMatchId(res.matchId);
      } catch (err) {
        console.error("matchmaking failed", err);
      }
    }
    initMatchmaking();
  }, [matchId]);

  // POST MATCH RESULT TO DM
  useEffect(() => {
    if (!matchResult || !state || !isInviteGame) return;

    const currentUserId = String(decodeToken(getStoredToken())?.id);
    const p1 = state.players[0];
    const p2 = state.players[1];

    // Only Player 1 posts to avoid both users sending the same message
    if (p1?.userId !== currentUserId) return;

    const p1Name = p1?.name || "Player 1";
    const p2Name = p2?.name || "Player 2";
    const content = matchResult === "DRAW"
      ? `⚔ ${p1Name} and ${p2Name} drew`
      : matchResult === p1Name
        ? `⚔ ${p1Name} defeated ${p2Name}`
        : `⚔ ${p2Name} defeated ${p1Name}`;

    async function postResult() {
      try {
        const dm = await createConversation("private", [p2.userId]);
        await postSystemMessage(dm.id, content);
      } catch (err) {
        console.error("[game result] failed to post chat notification:", err);
      }
    }

    postResult();
  }, [matchResult]);

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

  useEffect(() => {
    if (!state?.players) return;

    let urls = [];

    async function loadAvatars() {
      const entries = await Promise.all(
        state.players.map(async (p) => {
          if (!p?.userId) return [p?.userId, null];

          try {
            const blob = await getImgById(p.userId);
            const url = URL.createObjectURL(blob);
            urls.push(url);
            return [p.userId, url];
          } catch {
            return [p.userId, null];
          }
        })
      );

      setAvatars(Object.fromEntries(entries));
    }

    loadAvatars();

    return () => {
      setTimeout(() => {
        urls.forEach((u) => URL.revokeObjectURL(u));
      }, 1000);
    };
  }, [state?.players]);

  useEffect(() => {
    if (state?.status !== "paused" || !state?.pause?.startedAt) {
      setRemainingTime(null);
      return;
    }

    const update = () => {
      const elapsed = Date.now() - state.pause.startedAt;
      const left = Math.max(0, state.pause.timeoutMs - elapsed);
      setRemainingTime(Math.ceil(left / 1000));
    };

    update();

    const interval = setInterval(update, 250);

    return () => clearInterval(interval);
  }, [state?.status, state?.pause?.startedAt]);

  const isLoading =
    !matchId ||
    !state ||
    (!state.matchOver && state.status !== "playing" && state.status !== "paused");

  return (
    <div className="relative min-h-screen overflow-hidden bg-voidBlack font-mono text-cyan-50">
      <AnimatePresence mode="wait">
        {isLoading || !ready ? (
          <motion.div 
            key="loader"
            exit={{ opacity: 0, scale: 1.1 }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="min-h-screen w-full bg-[#04070b]"
          >
            <Navbar />
            <MatchmakingLoader />
          </motion.div>
        ) : (
          <motion.div
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative min-h-screen w-full bg-[#04070b]"
          >
            {/* Background Effects */}
            <div className="pointer-events-none absolute inset-0">
              <div className="grid-atmosphere" />
              <div className="grid-floor" />
              <div className="scanline-overlay" />
            </div>

            <main className="relative z-20 flex flex-col items-center justify-center gap-6 px-3 py-6 sm:gap-8 sm:px-8 sm:py-10 xl:flex-row xl:gap-16 xl:px-10 xl:py-16">
              
              {/* PLAYER 1 */}
              <motion.section
                initial={{ x: -200, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="flex w-28 sm:w-32 min-[1000px]:w-64 flex-col items-center gap-3 min-[1000px]:gap-6 rounded-xl border border-cyan-300/30 bg-black/40 p-3 sm:p-4 min-[1000px]:p-8 backdrop-blur"
              >
                <div className="relative">
                  <div className="flex h-12 w-12 min-[1000px]:h-24 min-[1000px]:w-24 items-center justify-center rounded-full border border-cyan-300/40 shadow-[0_0_40px_#00f7ff]">
                    {avatars[state.players[0]?.userId] ? (
                      <img
                        src={avatars[state.players[0]?.userId]}
                        className="h-full w-full object-cover rounded-full brightness-125 contrast-110"
                      />
                    ) : (
                      <UserRound size={50} className="text-cyan-400 w-6 h-6 min-[1000px]:w-[50px] min-[1000px]:h-[50px]" />
                    )}
                  </div>
                  <div className="absolute -bottom-2 right-0 rounded bg-cyan-500 px-2 py-0.5 text-[10px] font-bold text-black">P1</div>
                </div>
                <h2 className="text-sm min-[1000px]:text-xl uppercase tracking-[0.2em] text-cyan-300">{state.players[0]?.name || "Player 1"}</h2>
                <Lives lives={state.players[0]?.lives} maxLives={config.startingLives} />
              </motion.section>

              {/* ARENA */}
              <div className="flex flex-col items-center gap-10">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="relative flex w-full max-w-[1000px] aspect-[25/18] max-h-[60vh] sm:max-h-[70vh] items-center justify-center rounded-xl border border-cyan-300/40 bg-black shadow-[0_0_40px_#00f7ff]"
                >
                  {!state?.board && (
                    <div className="text-red-500 text-xl">
                      NO BOARD DATA
                    </div>
                  )}
                  {state?.status === "paused" && (
                    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#04070b]">
                      <div className="text-center">
                        <h2 className="text-4xl text-cyan-300 uppercase tracking-[0.3em] mb-4">
                          Opponent Disconnected
                        </h2>
                        <p className="text-xs text-cyan-500 mt-4 tracking-widest">
                          Reconnecting... ({remainingTime}s)
                        </p>
                        <p className="text-xs text-cyan-500 mt-4 tracking-widest">
                          Waiting for reconnection...
                        </p>
                      </div>
                    </div>
                  )}
                  {state?.board && (
                    <TronCanvas engineState={state} config={config} />
                  )}
                  {matchResult && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="pointer-events-auto absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#04070b] bg-[#04070b] border border-cyan-500/30"
                    >
                      {/* Título con efecto Neón */}
                      <h2 className="neon-title text-5xl font-bold uppercase tracking-[0.3em] text-cyan-100 mb-12 drop-shadow-[0_0_20px_rgba(0,247,255,0.8)]">
                        {matchResult === "DRAW" ? "DRAW" : `${matchResult} WINS`}
                      </h2>

                      {/* Contenedor de botones */}
                      <div className="flex gap-6">
                        <button
                          className="neon-button px-10 py-4 bg-cyan-500/10 hover:bg-cyan-500/30 border border-cyan-400/60 text-cyan-50 transition-all duration-300 uppercase tracking-widest text-sm font-bold shadow-[0_0_15px_rgba(0,247,255,0.2)] hover:shadow-[0_0_25px_rgba(0,247,255,0.4)]"
                          onClick={() => {
                            localStorage.removeItem("activeMatch");
                            setMatchId(null);
                          }}
                        >
                          Play Another Game
                        </button>
                        
                        <button
                          className="neon-button px-10 py-4 bg-cyan-500/10 hover:bg-cyan-500/30 border border-cyan-400/60 text-cyan-50 transition-all duration-300 uppercase tracking-widest text-sm font-bold shadow-[0_0_15px_rgba(0,247,255,0.2)] hover:shadow-[0_0_25px_rgba(0,247,255,0.4)]"
                          onClick={() => window.location.href = "/"}
                        >
                          Back to Home
                        </button>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
                <div className="flex items-center gap-4 text-xs uppercase tracking-[0.3em] text-cyan-100/50">
                  <Globe size={14} className="animate-pulse" />
                  <span>GLOBAL PVP</span>
                </div>
              </div>

              {/* PLAYER 2 */}
              <motion.section
                initial={{ x: 200, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="flex w-28 sm:w-32 min-[1000px]:w-64 flex-col items-center gap-3 min-[1000px]:gap-6 rounded-xl border border-pink-500/30 bg-black/40 p-3 sm:p-4 min-[1000px]:p-8 backdrop-blur"
              >
                <div className="relative">
                  <div className="flex h-12 w-12 min-[1000px]:h-24 min-[1000px]:w-24 items-center justify-center rounded-full border border-pink-500/40 shadow-[0_0_40px_#ff007f]">
                    {avatars[state.players[1]?.userId] ? (
                      <img
                        src={avatars[state.players[1]?.userId]}
                        className="h-full w-full object-cover rounded-full brightness-125 contrast-110"
                      />
                    ) : (
                      <UserRound size={50} className="text-cyan-400 w-6 h-6 min-[1000px]:w-[50px] min-[1000px]:h-[50px]" />
                    )}
                  </div>
                  <div className="absolute -bottom-2 left-0 rounded bg-pink-500 px-2 py-0.5 text-[10px] font-bold text-black">P2</div>
                </div>
                <h2 className="text-sm min-[1000px]:text-xl uppercase tracking-[0.2em] text-pink-500">{state.players[1]?.name || "Waiting..."}</h2>
                <Lives lives={state.players[1]?.lives} maxLives={config.startingLives} />
              </motion.section>
            </main>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

}
