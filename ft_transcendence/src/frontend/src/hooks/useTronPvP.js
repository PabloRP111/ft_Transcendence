import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { joinPvpMatch } from "../api/game";
import { useAuth } from "../context/AuthContext";

export function useTronPvP(matchId) {
  const { accessToken } = useAuth();
  const [state, setState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [playerId, setPlayerId] = useState(null);

  const socketRef = useRef(null);

  useEffect(() => {
    if (!matchId || !accessToken) return;

    // Reset game state so the previous match's result overlay doesn't persist
    // while the new socket connection is being established.
    setState(null);

    let mounted = true;

    async function init() {
      try {
        const res = await joinPvpMatch(matchId);
        if (!mounted) return;

        setPlayerId(res.playerId);

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
          console.log("CONNECTED", socket.id);

          socket.emit("join_match", { matchId });
        });

        socket.on("state_update", (gameState) => {
          if (gameState.board instanceof ArrayBuffer)
            gameState.board = new Uint8Array(gameState.board);
          setState(gameState);
        });

        socket.on("disconnect", () => {
          setIsConnected(false);
        });

        socket.on("connect_error", (err) => {
          console.error("ERROR:", err.message);
        });

        socketRef.current = socket;

      } catch (error) {
        console.error("Error inicializando el juego:", error);
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
