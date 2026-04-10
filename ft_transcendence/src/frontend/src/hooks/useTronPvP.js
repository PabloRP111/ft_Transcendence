import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { joinPvpMatch } from "../api/game";

export function useTronPvP(matchId, token) {
  const [state, setState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [playerId, setPlayerId] = useState(null);

  const socketRef = useRef(null);

  useEffect(() => {
    if (!matchId) return;

    let mounted = true;

    async function init() {
      try {
        const res = await joinPvpMatch(matchId);
        if (!mounted) return;

        setPlayerId(res.playerId);

        const socket = io(window.location.origin, {
          path: "/socket.io/game",
          transports: ["websocket"],
          auth: { token }
        });

        socket.on("connect", () => {
          setIsConnected(true);

          socket.emit("join_match", {
            matchId,
          });
        });

        socket.on("state_update", (gameState) => {
          setState(gameState);
        });

        socket.on("disconnect", () => {
          setIsConnected(false);
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
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [matchId, token]);

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
      playerKeymap: {
        w: "UP", a: "LEFT", s: "DOWN", d: "RIGHT",
        ArrowUp: "UP", ArrowLeft: "LEFT", ArrowDown: "DOWN", ArrowRight: "RIGHT",
      },
      startingLives: 3,
    },
    matchResult: state?.winner?.name || (state?.matchOver ? "DRAW" : null),
  };
}
