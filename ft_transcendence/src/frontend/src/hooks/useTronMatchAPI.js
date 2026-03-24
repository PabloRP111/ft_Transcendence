import { useCallback, useEffect, useRef, useState } from "react";
import {
  DIRECTIONS,
  GRID_HEIGHT,
  GRID_WIDTH,
  STARTING_LIVES,
  TICK_MS,
} from "../game/tron/constants";
import {
  createGameMatch,
  moveGameMatch,
  resetRoundGameMatch,
} from "../api/game";

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

function normalizeBoard(board) {
  if (board instanceof Uint8Array) {
    return board;
  }

  if (Array.isArray(board)) {
    return Uint8Array.from(board);
  }

  const normalized = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);

  if (board && typeof board === "object") {
    for (let i = 0; i < normalized.length; i += 1) {
      normalized[i] = Number(board[i] ?? 0);
    }
  }

  return normalized;
}

function createInitialState() {
  const board = new Uint8Array(GRID_WIDTH * GRID_HEIGHT);
  const playerY = Math.floor(GRID_HEIGHT / 2);

  const players = [
    {
      id: 1,
      name: "Player",
      isAi: false,
      x: 20,
      y: playerY,
      dir: DIRECTIONS.RIGHT,
      pendingDir: null,
      alive: true,
      lives: STARTING_LIVES,
      score: 0,
    },
    {
      id: 2,
      name: "AI",
      isAi: true,
      x: GRID_WIDTH - 21,
      y: playerY,
      dir: DIRECTIONS.LEFT,
      pendingDir: null,
      alive: true,
      lives: STARTING_LIVES,
      score: 0,
    },
  ];

  board[playerY * GRID_WIDTH + 20] = 1;
  board[playerY * GRID_WIDTH + (GRID_WIDTH - 21)] = 2;

  return {
    board,
    tick: 0,
    players,
    roundOver: false,
    winnerId: null,
    draw: false,
  };
}

export function useTronMatch() {
  const engineRef = useRef(createInitialState());
  const matchIdRef = useRef(null);
  const pendingDirectionRef = useRef(null);
  const requestInFlightRef = useRef(false);

  const [phase, setPhase] = useState("countdown");
  const [countdown, setCountdown] = useState(3);
  const [matchResult, setMatchResult] = useState(null);
  const [serviceReady, setServiceReady] = useState(false);
  const [hud, setHud] = useState(() => {
    const state = engineRef.current;
    return {
      players: [...state.players],
      tick: state.tick,
    };
  });

  const syncRemoteState = useCallback((remoteState) => {
    if (!remoteState || typeof remoteState !== "object") {
      return engineRef.current;
    }

    const normalized = {
      ...remoteState,
      board: normalizeBoard(remoteState.board),
      players: Array.isArray(remoteState.players)
        ? remoteState.players
        : engineRef.current.players,
      tick: typeof remoteState.tick === "number" ? remoteState.tick : engineRef.current.tick,
    };

    engineRef.current = normalized;
    setHud({ players: [...normalized.players], tick: normalized.tick });
    return normalized;
  }, []);

  const bootMatch = useCallback(async () => {
    const payload = await createGameMatch();
    matchIdRef.current = payload.matchId;
    pendingDirectionRef.current = null;
    requestInFlightRef.current = false;
    syncRemoteState(payload.state);
    setServiceReady(true);
  }, [syncRemoteState]);

  const queueDirection = useCallback((playerId, dir) => {
    if (playerId !== 1 || phase === "finished") {
      return;
    }

    pendingDirectionRef.current = dir;
  }, [phase]);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        await bootMatch();
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Failed to initialize game match", error);
        setMatchResult("Game service unavailable");
        setPhase("finished");
      }
    };

    start();

    return () => {
      cancelled = true;
    };
  }, [bootMatch]);

  const restartMatch = useCallback(() => {
    setMatchResult(null);
    setCountdown(3);
    setPhase("countdown");
    setServiceReady(false);

    bootMatch().catch((error) => {
      console.error("Failed to restart match", error);
      setMatchResult("Unable to restart match");
      setPhase("finished");
    });
  }, [bootMatch]);

  useEffect(() => {
    if (phase !== "countdown" || !serviceReady) {
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
  }, [phase, countdown, serviceReady]);

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
      if (requestInFlightRef.current || !matchIdRef.current) {
        return;
      }

      requestInFlightRef.current = true;

      moveGameMatch(matchIdRef.current, {
        playerId: 1,
        direction: pendingDirectionRef.current,
      })
        .then((payload) => {
          pendingDirectionRef.current = null;
          const state = syncRemoteState(payload.state);

          if (payload.matchOver) {
            setMatchResult(payload.winner ? `${payload.winner.name} wins the match` : "Draw match");
            setPhase("finished");
            return;
          }

          if (state.roundOver) {
            setPhase("round-over");
          }
        })
        .catch((error) => {
          console.error("Game tick failed", error);
          setMatchResult("Connection with game service lost");
          setPhase("finished");
        })
        .finally(() => {
          requestInFlightRef.current = false;
        });
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [phase, syncRemoteState]);

  useEffect(() => {
    if (phase !== "round-over") {
      return undefined;
    }

    const timer = setTimeout(() => {
      if (!matchIdRef.current) {
        return;
      }

      resetRoundGameMatch(matchIdRef.current)
        .then((payload) => {
          syncRemoteState(payload.state);
          pendingDirectionRef.current = null;
          setCountdown(3);
          setPhase("countdown");
        })
        .catch((error) => {
          console.error("Round reset failed", error);
          setMatchResult("Unable to reset round");
          setPhase("finished");
        });
    }, 1200);

    return () => clearTimeout(timer);
  }, [phase, syncRemoteState]);

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
