import { useCallback, useEffect, useRef, useState } from "react";
import { chooseAiDirection } from "../game/tron/ai";
import {
  createMatchState,
  getMatchWinner,
  isMatchOver,
  queuePlayerDirection,
  resetRound,
  stepSimulation,
} from "../game/tron/engine";
import { TICK_MS } from "../game/tron/constants";

function phaseLabel(phase) {
  if (phase === "countdown") {
    return "3";
  }

  if (phase === "ready") {
    return "READY";
  }

  if (phase === "fight") {
    return "FIGHT";
  }

  return null;
}

export function useTronMatch() {
  const engineRef = useRef(createMatchState());
  const [phase, setPhase] = useState("countdown");
  const [countdown, setCountdown] = useState(3);
  const [matchResult, setMatchResult] = useState(null);
  const [hud, setHud] = useState(() => {
    const state = engineRef.current;
    return {
      players: state.players,
      tick: state.tick,
    };
  });

  const queueDirection = useCallback((playerId, dir) => {
    queuePlayerDirection(engineRef.current, playerId, dir);
  }, []);

  const restartMatch = useCallback(() => {
    engineRef.current = createMatchState();
    setHud({ players: engineRef.current.players, tick: 0 });
    setMatchResult(null);
    setCountdown(3);
    setPhase("countdown");
  }, []);

  useEffect(() => {
    if (phase !== "countdown") {
      return undefined;
    }

    if (countdown === 0) {
      setPhase("ready");
      return undefined;
    }

    const timer = setTimeout(() => {
      setCountdown((value) => Math.max(0, value - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [phase, countdown]);

  useEffect(() => {
    if (phase !== "ready") {
      return undefined;
    }

    const timer = setTimeout(() => {
      setPhase("fight");
    }, 600);

    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "fight") {
      return undefined;
    }

    const timer = setTimeout(() => {
      setPhase("playing");
    }, 700);

    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing") {
      return undefined;
    }

    const interval = setInterval(() => {
      const state = engineRef.current;
      const aiPlayer = state.players.find((p) => p.isAi && p.alive);

      if (aiPlayer) {
        const aiNextDirection = chooseAiDirection(state, aiPlayer);
        queuePlayerDirection(state, aiPlayer.id, aiNextDirection);
      }

      stepSimulation(state);
      setHud({ players: [...state.players], tick: state.tick });

      if (state.roundOver) {
        clearInterval(interval);

        if (isMatchOver(state)) {
          const winner = getMatchWinner(state);
          setMatchResult(winner ? `${winner.name} wins the match` : "Draw match");
          setPhase("finished");
          return;
        }

        setPhase("round-over");
      }
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase !== "round-over") {
      return undefined;
    }

    const timer = setTimeout(() => {
      resetRound(engineRef.current);
      setHud({ players: [...engineRef.current.players], tick: engineRef.current.tick });
      setCountdown(3);
      setPhase("countdown");
    }, 1200);

    return () => clearTimeout(timer);
  }, [phase]);

  return {
    engineRef,
    phase,
    countdown,
    overlayText: phaseLabel(phase),
    hud,
    matchResult,
    queueDirection,
    restartMatch,
  };
}
