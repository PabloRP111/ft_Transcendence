import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { UserRound, Heart } from "lucide-react";

function Lives({ lives }) {
  return (
    <div className="flex gap-2">
      {[0,1,2].map(i => (
        <motion.div
          key={i}
          animate={i < lives ? { scale:[1,1.2,1] } : {}}
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

  const [countdown, setCountdown] = useState(3);
  const [phase, setPhase] = useState("countdown");

  useEffect(() => {

    const timer = setInterval(() => {
      setCountdown(prev => {

        if (prev === 1) {
          clearInterval(timer);
          setPhase("ready");

          setTimeout(()=>{
            setPhase("fight");
          },1200);

          return 0;
        }

        return prev - 1;
      });
    },1000);

    return () => clearInterval(timer);

  },[]);

  useEffect(() => {
    if (phase !== "fight") return;

    const t = setTimeout(() => {
      setPhase("playing");
    }, 1000);

    return () => clearTimeout(t);
  }, [phase]);

  const player1 = {
    name:"PlayerOne",
    lives:2,
    score:1
  };

  const player2 = {
    name:"PlayerTwo",
    lives:2,
    score:0
  };

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
            {player1.name}
          </h2>

          <Lives lives={player1.lives}/>

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

            <span className="text-cyan-200/40 uppercase tracking-widest">
              {/* COUNTDOWN */}
          {phase === "countdown" && (
            <motion.div
              key={countdown}
              initial={{scale:0}}
              animate={{scale:[1,1.4,1]}}
              className="text-6xl text-cyan-300 drop-shadow-[0_0_25px_#00f7ff]"
            >
              {countdown}
            </motion.div>
          )}

          {/* READY */}
          {phase === "ready" && (
            <motion.div
              initial={{scale:0}}
              animate={{scale:[1,1.2,1]}}
              className="text-5xl text-cyan-300 drop-shadow-[0_0_25px_#00f7ff]"
            >
              READY
            </motion.div>
          )}

          {/* FIGHT */}
          {phase === "fight" && (
            <motion.div
              initial={{scale:0}}
              animate={{scale:[1,1.5,1]}}
              transition={{duration:0.6}}
              className="text-6xl text-red-400 drop-shadow-[0_0_25px_red]"
            >
              FIGHT
            </motion.div>
          )}
            </span>

          </motion.div>
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
            {player2.name}
          </h2>

          <Lives lives={player2.lives}/>

        </motion.section>

      </main>

    </div>
  );
}