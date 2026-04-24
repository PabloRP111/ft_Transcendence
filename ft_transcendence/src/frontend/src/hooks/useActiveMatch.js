import { useState, useEffect } from "react";

// Returns true when the current user has an ongoing match (playing, paused, or waiting).
// Stays in sync with useTronPvP which fires "active-match-changed" whenever the match
// is created, resumed, or finished.
export function useActiveMatch() {
  const [hasActiveMatch, setHasActiveMatch] = useState(
    () => !!localStorage.getItem("activeMatch")
  );

  useEffect(() => {
    const handler = (e) => setHasActiveMatch(!!e.detail);
    window.addEventListener("active-match-changed", handler);
    return () => window.removeEventListener("active-match-changed", handler);
  }, []);

  return hasActiveMatch;
}
