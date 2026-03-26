import { useEffect, useRef } from "react";
import { CELL_SIZE, GRID_HEIGHT, GRID_WIDTH, PLAYER_COLORS } from "../game/tron/constants";

const ARENA_WIDTH = GRID_WIDTH * CELL_SIZE;
const ARENA_HEIGHT = GRID_HEIGHT * CELL_SIZE;

export default function TronCanvas({ engineRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let animationFrameId;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return undefined;
    }

    const render = () => {
      const state = engineRef.current;
      const { board, players } = state;

      context.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
      context.fillStyle = "#04070b";
      context.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

      for (let y = 0; y < GRID_HEIGHT; y += 1) {
        for (let x = 0; x < GRID_WIDTH; x += 1) {
          const cell = board[y * GRID_WIDTH + x];
          if (cell === 0) {
            continue;
          }

          context.fillStyle = PLAYER_COLORS[cell] ?? "#d8fbff";
          context.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }

      for (const player of players) {
        if (!player.alive) {
          continue;
        }

        context.fillStyle = "#f8ffff";
        context.fillRect(player.x * CELL_SIZE, player.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }

      animationFrameId = window.requestAnimationFrame(render);
    };

    animationFrameId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [engineRef]);

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
