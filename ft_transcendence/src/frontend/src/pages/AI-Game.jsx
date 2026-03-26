import { motion } from "framer-motion";
import { useEffect } from "react";
import { UserRound, Heart } from "lucide-react";
import TronCanvas from "../components/TronCanvas";
import { useTronMatch} from "../hooks/useTronMatchAPI";
import { STARTING_LIVES } from "../game/tron/constants";
import { PLAYER_ONE_KEYMAP } from "../game/tron/input";

function Lives({ lives }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: STARTING_LIVES }).map((_, i) => (
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
  const {
    engineRef,
    phase,
    countdown,
    overlayText,
    hud,
    matchResult,
    queueDirection,
    restartMatch,
  } = useTronMatch();

  const player1 = hud.players[0];
  const player2 = hud.players[1];

  useEffect(() => {
    const handleKeyDown = (event) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const nextDirection = PLAYER_ONE_KEYMAP[key];

      if (!nextDirection || phase === "finished") {
        return;
      }

      event.preventDefault();
      queueDirection(1, nextDirection);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, queueDirection]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-voidBlack font-mono text-cyan-50">

      {/* BACKGROUND */}
      <div className="pointer-events-none absolute inset-0">
        <div className="grid-atmosphere"/>
        <div className="grid-floor"/>
        <div className="scanline-overlay"/>
      </div>

      <main className="relative z-20 flex items-center justify-center gap-16 px-10 py-16">

        {/* PLAYER LEFT */}
        <motion.section
          initial={{x:-200,opacity:0}}
          animate={{x:0,opacity:1}}
          transition={{duration:0.7}}
          className="flex w-64 flex-col items-center gap-6 rounded-xl border border-cyan-300/30 bg-black/40 p-8 backdrop-blur"
        >

          <motion.div
            animate={{y:[0,-4,0]}}
            transition={{repeat:Infinity,duration:1.4}}
            className="flex h-24 w-24 items-center justify-center rounded-full border border-cyan-300/40 shadow-[0_0_40px_#00f7ff]"
          >
            <UserRound size={50}/>
          </motion.div>

          <h2 className="text-xl uppercase tracking-[0.2em] text-gridBlue">
            {player1?.name ?? "Player"}
          </h2>

          <Lives lives={player1?.lives ?? STARTING_LIVES} />

          <p className="text-sm uppercase tracking-[0.2em] text-cyan-100/80">
            Score {player1?.score ?? 0}
          </p>

        </motion.section>


        {/* CENTER ARENA */}
        <div className="flex flex-col items-center gap-10">

          {/* ARENA */}
          <motion.div
            initial={{scale:0.9,opacity:0}}
            animate={{scale:1,opacity:1}}
            transition={{delay:0.3}}
            className="relative flex h-[720px] w-[1000px] items-center justify-center rounded-xl border border-cyan-300/40 bg-black shadow-[0_0_40px_#00f7ff]"
          >

            <motion.div
              className="absolute inset-0 rounded-xl"
              animate={{
                boxShadow:[
                  "0 0 20px #00f7ff",
                  "0 0 60px #00f7ff",
                  "0 0 20px #00f7ff"
                ]
              }}
              transition={{repeat:Infinity,duration:2}}
            />

            <TronCanvas engineRef={engineRef} />

            <div className="pointer-events-none absolute left-0 top-0 z-20 h-full w-full">
              {/* COUNTDOWN */}
              {phase === "countdown" && (
                <motion.div
                  key={countdown}
                  initial={{ scale: 0 }}
                  animate={{ scale: [1, 1.4, 1] }}
                  className="absolute inset-0 flex items-center justify-center text-6xl text-cyan-300 drop-shadow-[0_0_25px_#00f7ff]"
                >
                  {countdown}
                </motion.div>
              )}

              {(phase === "ready" || phase === "fight") && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [1, 1.3, 1] }}
                  className={
                    phase === "fight"
                      ? "absolute inset-0 flex items-center justify-center text-6xl text-red-400 drop-shadow-[0_0_25px_red]"
                      : "absolute inset-0 flex items-center justify-center text-5xl text-cyan-300 drop-shadow-[0_0_25px_#00f7ff]"
                  }
                >
                  {overlayText}
                </motion.div>
              )}

              {phase === "finished" && (
                <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/65 backdrop-blur-sm">
                  <p className="text-2xl uppercase tracking-[0.22em] text-cyan-100">{matchResult}</p>
                  <button
                    className="neon-button px-6 py-3"
                    onClick={restartMatch}
                  >
                    Restart Match
                  </button>
                </div>
              )}
            </div>

          </motion.div>

          <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/75">
            Controls: WASD or Arrow keys
          </p>

        </div>


        {/* PLAYER RIGHT */}
        <motion.section
          initial={{x:200,opacity:0}}
          animate={{x:0,opacity:1}}
          transition={{duration:0.7}}
          className="flex w-64 flex-col items-center gap-6 rounded-xl border border-cyan-300/30 bg-black/40 p-8 backdrop-blur"
        >

          <motion.div
            animate={{y:[0,-4,0]}}
            transition={{repeat:Infinity,duration:1.4}}
            className="flex h-24 w-24 items-center justify-center rounded-full border border-cyan-300/40 shadow-[0_0_40px_#00f7ff]"
          >
            <UserRound size={50}/>
          </motion.div>

          <h2 className="text-xl uppercase tracking-[0.2em] text-gridBlue">
            {player2?.name ?? "AI"}
          </h2>

          <Lives lives={player2?.lives ?? STARTING_LIVES} />

          <p className="text-sm uppercase tracking-[0.2em] text-cyan-100/80">
            Score {player2?.score ?? 0}
          </p>

        </motion.section>

      </main>

    </div>
  );
}