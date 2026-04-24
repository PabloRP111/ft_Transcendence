import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { joinPvpMatch } from "../api/game";
import { useAuth } from "../context/AuthContext";

export function useTronPvP(matchId) {
  const { accessToken } = useAuth();
  const [state, setState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [playerId, setPlayerId] = useState(null);
  const [invalidMatch, setInvalidMatch] = useState(false);

  const socketRef = useRef(null);

  useEffect(() => {
    if (!matchId || !accessToken) return;

    setInvalidMatch(false);

    // Reset game state so the previous match's result overlay doesn't persist
    // while the new socket connection is being established.
    setState(null);

    let mounted = true;

    async function init() {
      try {
        const res = await joinPvpMatch(matchId);
        if (!mounted) return;

        setPlayerId(res.playerId);
        localStorage.setItem("activeMatch", matchId);
        window.dispatchEvent(
          new CustomEvent("active-match-changed", { detail: matchId })
        );

        if (socketRef.current) {
          socketRef.current.disconnect();
        }

        const socket = io(`${window.location.origin}/game`, {
          path: "/socket.io/game",
          transports: ["websocket"],
          auth: { token: accessToken },
        });

        socket.on("connect", () => {
          setIsConnected(true);
          socket.emit("join_match", { matchId });
        });

        socket.on("state_update", (gameState) => {
          const board = gameState?.board;
          const normalizedBoard = board?.data
            ? board.data
            : board instanceof ArrayBuffer
              ? new Uint8Array(board)
              : board;

          setState({
            ...gameState,
            board: normalizedBoard,
          });
          if (gameState.status === "playing") {
            localStorage.setItem("activeMatch", matchId);
            window.dispatchEvent(
              new CustomEvent("active-match-changed", { detail: matchId })
            );
          }
          if (gameState.matchOver) {
            localStorage.removeItem("activeMatch");
            window.dispatchEvent(
              new CustomEvent("active-match-changed", { detail: null })
            );
          }
        });

        socket.on("disconnect", () => {
          setIsConnected(false);
        });

        socket.on("connect_error", (err) => {
          console.error("ERROR:", err.message);
        });

        socketRef.current = socket;

      } catch (error) {
        const message = String(error?.message || "");
        if (
          message.includes("Match not found") ||
          message.includes("Match full") ||
          message.includes("Not a PvP match") ||
          message.includes("Forbidden")
        ) {
          localStorage.removeItem("activeMatch");
          window.dispatchEvent(
            new CustomEvent("active-match-changed", { detail: null })
          );
          setState(null);
          setInvalidMatch(true);
          return;
        }
      }
    }

    init();

    return () => {
      mounted = false;

      if (socketRef.current) {
        socketRef.current.off(); 
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [matchId, accessToken]);

  const sendMove = (direction) => {
    if (!isConnected || state?.status !== "playing") return;
    socketRef.current?.emit("move", { direction });
  };

  return {
    state,
    isConnected,
    playerId,
    invalidMatch,
    isPlaying: state?.status === "playing",
    sendMove,
    config: {
      gridWidth: 100,
      gridHeight: 72,
      cellSize: 10,
      playerColors: {
        1: "#00f7ff",
        2: "#ff8c00",
      },
      playerKeymap: {
        w: "UP", a: "LEFT", s: "DOWN", d: "RIGHT",
        ArrowUp: "UP", ArrowLeft: "LEFT", ArrowDown: "DOWN", ArrowRight: "RIGHT",
      },
      startingLives: 3,
    },
    matchResult: state?.winner?.name || (state?.matchOver ? "DRAW" : null),
  };
}
