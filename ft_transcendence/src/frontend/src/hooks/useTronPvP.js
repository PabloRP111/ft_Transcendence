import { useEffect, useState, useRef } from "react";

export function useTronPvP(matchId, token) {
  const [state, setState] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(
      `ws://localhost:3000?matchId=${matchId}&playerId=1`,
      [],
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setState(data.state);
    };

    wsRef.current = ws;

    return () => ws.close();
  }, [matchId]);

  const sendMove = (direction) => {
    wsRef.current?.send(JSON.stringify({
      type: "MOVE",
      direction,
    }));
  };

  return { state, sendMove };
}
