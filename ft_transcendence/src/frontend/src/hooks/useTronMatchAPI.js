import { useState, useEffect } from "react";
import { createGameMatch, moveGameMatch, resetRoundGameMatch, getConfig } from "../api/game";

export function useTronBackendMatch() {
  const [config, setConfig] = useState(null);
  const [matchId, setMatchId] = useState(null);
  const [state, setState] = useState(null);
  const matchesWon = state?.matchesWon || [0, 0];

  useEffect(() => {
    async function init() {
      const cfg = await getConfig();
      setConfig(cfg);
      const res = await createGameMatch({ previousMatchesWon: matchesWon });
      setMatchId(res.matchId);
      setState(res.state);
    }
    init();
  }, []);

  useEffect(() => {
    if (!matchId || !config || state?.roundOver || state?.matchOver)
      return;

    const interval = setInterval(async () => {
      const res = await moveGameMatch(matchId, {});
      syncState(res);
    }, config.tickMs);

    return () => clearInterval(interval);
  }, [matchId, config, state?.roundOver, state?.matchOver]);

  useEffect(() => {
    if (!state?.roundOver || state?.matchOver)
      return;

    const timeout = setTimeout(async () => {
      const res = await resetRoundGameMatch(matchId);
      syncState(res);
    }, 1200);

    return () => clearTimeout(timeout);
  }, [state?.roundOver, state?.matchOver, matchId]);

  const syncState = (res) => {
    setState(res.state);
  };

  const sendMove = async (playerId, direction) => {
    if (!matchId || state?.roundOver)
      return;
    const res = await moveGameMatch(matchId, { playerId, direction });
    syncState(res);
  };

  const restartMatch = async () => {
    const res = await createGameMatch({ 
      previousMatchesWon: state.matchesWon 
    });
    setMatchId(res.matchId);
    setState(res.state);
  };

  return { 
    config, 
    state, 
    matchResult: state?.winner?.name || (state?.matchOver ? "DRAW" : null), 
    matchesWon, 
    sendMove, 
    restartMatch 
  };
}
