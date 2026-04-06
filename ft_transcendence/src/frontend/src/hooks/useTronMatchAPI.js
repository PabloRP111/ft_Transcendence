import { useState, useEffect } from "react";
import { createGameMatch, moveGameMatch, resetRoundGameMatch, getConfig } from "../api/game";

export function useTronBackendMatch() {
  const [config, setConfig] = useState(null);
  const [matchId, setMatchId] = useState(null);
  const [state, setState] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [matchesWon, setMatchesWon] = useState([0, 0]); // [player, AI]

  // INIT
  useEffect(() => {
    async function init() {
      try {
        const cfg = await getConfig();
        setConfig(cfg);

        const res = await createGameMatch({ previousMatchesWon: matchesWon });
        setMatchId(res.matchId);

        res.state.matchesWon = matchesWon;
        setState(res.state);
      } catch (err) {
        console.error("Init failed:", err);
      }
    }
    init();
  }, []);

  // GAME LOOP
  useEffect(() => {
    if (!matchId || !config || state?.roundOver) return;

    const interval = setInterval(async () => {
      const res = await moveGameMatch(matchId, {});
      setState(res.state);

      if (res.matchOver) {
        setMatchResult(res.winner ? res.winner.name : "DRAW");
        console.log("MATCH OVER:", res);
      }
    }, config.tickMs);

    return () => clearInterval(interval);
  }, [matchId, config, state?.roundOver]);

  // RESET ROUNDS
  useEffect(() => {
    if (!state?.roundOver || matchResult)
       return;

    const timeout = setTimeout(async () => {
      const res = await resetRoundGameMatch(matchId);
      setState(res.state);
    }, 1200);

    return () => clearTimeout(timeout);
  }, [state?.roundOver, matchResult, matchId]);

  // UPDATE MATCH WINS
  useEffect(() => {
    if (!state) return;

    const matchIsOver = state.players.some(p => p.lives <= 0);
    if (matchIsOver) {
      const winnerIndex = state.players.findIndex(p => p.lives > 0);
      if (winnerIndex >= 0) {
        setMatchesWon(prev => {
          const updated = [...prev];
          updated[winnerIndex] += 1;
          return updated;
        });
      }
    }
  }, [state]);

  // INPUT
  const sendMove = async (playerId, direction) => {
    if (!matchId) return;

    const res = await moveGameMatch(matchId, { playerId, direction });
    setState(res.state);

    if (res.matchOver) {
      setMatchResult(res.winner ? res.winner.name : "DRAW");
    }
  };

  // MANUAL RESTART
  const restartMatch = async () => {
    const res = await createGameMatch({ previousMatchesWon: matchesWon });
    setMatchId(res.matchId);
    res.state.matchesWon = matchesWon;
    setState(res.state);
    setMatchResult(null);
  };

  return { config, state, matchResult, sendMove, restartMatch };
}
