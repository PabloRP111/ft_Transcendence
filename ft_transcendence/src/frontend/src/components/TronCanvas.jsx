// src/components/TronCanvas.jsx
import { useEffect, useRef } from "react";

function TronCanvas({ engineState, config }) {
  const canvasRef = useRef(null);

  const ARENA_WIDTH = (config?.gridWidth || 20) * (config?.cellSize || 20);
  const ARENA_HEIGHT = (config?.gridHeight || 20) * (config?.cellSize || 20);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !engineState)
      return;

    let animationFrameId;

    const render = () => {
      if (!engineState || engineState.roundOver)
        return;

      const { board, players } = engineState;

      context.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
      context.fillStyle = "#04070b";
      context.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

      for (let y = 0; y < (config?.gridHeight || 20); y++) {
        for (let x = 0; x < (config?.gridWidth || 20); x++) {
          const cell = board[y * (config?.gridWidth || 20) + x];
          if (cell === 0) continue;
          context.fillStyle = config?.playerColors?.[cell] ?? "#d8fbff";
          context.fillRect(x * (config?.cellSize || 20), y * (config?.cellSize || 20), config?.cellSize || 20, config?.cellSize || 20);
        }
      }

      for (const player of players) {
        if (!player.alive) continue;
        context.fillStyle = "#f8ffff";
        context.fillRect(
          player.x * (config?.cellSize || 20),
          player.y * (config?.cellSize || 20),
          config?.cellSize || 20,
          config?.cellSize || 20
        );
      }
      animationFrameId = window.requestAnimationFrame(render);
    };

    animationFrameId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [engineState, config]);

  return (
    <div className="relative w-full max-w-[1000px]">
      <canvas
        ref={canvasRef}
        width={ARENA_WIDTH}
        height={ARENA_HEIGHT}
        className="h-auto w-full rounded-xl border border-cyan-300/40"
      />
    </div>
  );
}

export default TronCanvas;
