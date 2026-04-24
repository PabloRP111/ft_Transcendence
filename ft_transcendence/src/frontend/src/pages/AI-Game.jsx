import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { UserRound, Heart } from "lucide-react";
import aiAvatar from "../assets/ai_profile.jpg";
import TronCanvas from "../components/TronCanvas";
import { useTronBackendMatch } from "../hooks/useTronMatchAPI";
import { getCurrentUser, getImgById } from "../api/users";
import { useAuth } from "../context/AuthContext";
import { decodeToken } from "../utils/auth";

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

  const { isAuthenticated, accessToken } = useAuth();

  const [avatarUrl, setAvatarUrl] = useState("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    engineRef.current = state;
  }, [state]);

  // Loda data only if isAuth
  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    let objectUrl = null;

    async function load() {
      try {
        const user = await getCurrentUser();

        if (!user?.id) return;

        setUsername(user.username);

        const blob = await getImgById(user.id);
        objectUrl = URL.createObjectURL(blob);
        setAvatarUrl(objectUrl);
      } catch (err) {
        console.error("avatar load failed", err);
      }
    }

    load();

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isAuthenticated, accessToken]);

  // Input 
  useEffect(() => {
    if (!config || !state) return;

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

      <main className="relative z-20 flex flex-col items-center justify-center gap-6 px-3 py-6 sm:gap-8 sm:px-8 sm:py-10 xl:flex-row xl:gap-16 xl:px-10 xl:py-16">

        {/* PLAYER 1 */}
        <motion.section
          initial={{ x: -200, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex w-56 sm:w-64 flex-col items-center gap-6 rounded-xl border border-cyan-300/30 bg-black/40 p-6 sm:p-8 backdrop-blur"
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-full border border-cyan-300/40 shadow-[0_0_40px_#00f7ff] overflow-hidden">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                className="h-full w-full object-cover"
              />
            ) : (
              <UserRound size={50} />
            )}
          </div>

          <h2 className="text-xl uppercase tracking-[0.2em] text-gridBlue">
            {username || "Player 1"}
          </h2>

          <Lives
            lives={player1?.lives ?? config.startingLives}
            maxLives={config.startingLives}
          />

          <p className="text-sm uppercase tracking-[0.2em] text-cyan-100/80">
            Matches Won {state?.matchesWon?.[0] ?? 0}
          </p>
        </motion.section>

        {/* ARENA */}
        <div className="flex flex-col items-center gap-10">
          <div className="relative flex w-full max-w-[1000px] aspect-[25/18] max-h-[60vh] sm:max-h-[70vh] items-center justify-center rounded-xl border border-cyan-300/40 bg-black shadow-[0_0_40px_#00f7ff]">
            <TronCanvas engineState={state} config={config} />

            {matchResult && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#04070b] backdrop-blur-md">
                <h2 className="text-5xl font-bold uppercase text-cyan-100 mb-12">
                  {matchResult === "DRAW" ? "DRAW" : `${matchResult} WINS`}
                </h2>

                <div className="flex gap-6">
                  <button
                    onClick={() => restartMatch()}
                    className="px-6 py-3 border border-cyan-400 text-cyan-50"
                  >
                    Rematch
                  </button>

                  <button
                    onClick={() => window.location.href = "/"}
                    className="px-6 py-3 border border-cyan-400 text-cyan-50"
                  >
                    Back to Home
                  </button>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/75">
            Controls: WASD or Arrow keys
          </p>
        </div>

        {/* PLAYER 2 (AI) */}
        <motion.section
          initial={{ x: 200, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex w-56 sm:w-64 flex-col items-center gap-6 rounded-xl border border-cyan-300/30 bg-black/40 p-6 sm:p-8 backdrop-blur"
        >
          <div className="h-24 w-24 rounded-full overflow-hidden border border-cyan-300/40 shadow-[0_0_40px_#00f7ff]">
            <img
              src={aiAvatar}
              alt="AI Avatar"
              className="h-full w-full object-cover"
            />
          </div>

          <h2 className="text-xl uppercase tracking-[0.2em] text-gridBlue">
            {player2?.name || "AI_CORE"}
          </h2>

          <Lives
            lives={player2?.lives ?? config.startingLives}
            maxLives={config.startingLives}
          />

          <p className="text-sm uppercase tracking-[0.2em] text-cyan-100/80">
            Matches Won {state?.matchesWon?.[1] ?? 0}
          </p>
        </motion.section>
      </main>
    </div>
  );
}
