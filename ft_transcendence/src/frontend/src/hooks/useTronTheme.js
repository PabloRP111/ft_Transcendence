import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function useTronTheme() {
  const location = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    const path = location.pathname;

    // PROFILE (ámbar / naranja)
    if (path.startsWith("/profile")) {

      root.style.setProperty("--tron-primary", "rgba(255,140,0,0.35)");
      root.style.setProperty("--tron-primary-strong", "rgba(255,140,0,0.60)");
      root.style.setProperty("--tron-glow", "rgba(255,140,0,0.75)");
      root.style.setProperty("--tron-secondary", "rgba(255,220,120,0.12)");

      root.style.setProperty("--tron-text", "#ffd8b0");
      root.style.setProperty("--tron-border", "rgba(255,140,0,0.45)");
    }
    // GAME (rojo)
    else if (path.startsWith("/game")) {

      root.style.setProperty("--tron-primary", "rgba(255,60,60,0.35)");
      root.style.setProperty("--tron-primary-strong", "rgba(255,60,60,0.55)");
      root.style.setProperty("--tron-glow", "rgba(255,60,60,0.75)");
      root.style.setProperty("--tron-secondary", "rgba(255,120,0,0.15)");

      root.style.setProperty("--tron-text", "#ffd0d0");
      root.style.setProperty("--tron-border", "rgba(255,60,60,0.45)");
    }
    // CREDITS (dorado)
    // CREDITS (oro brillante)
    else if (path.startsWith("/credits")) {

      root.style.setProperty("--tron-primary", "rgba(255,215,90,0.35)");
      root.style.setProperty("--tron-primary-strong", "rgba(255,215,90,0.60)");
      root.style.setProperty("--tron-glow", "rgba(255,215,90,0.85)");
      root.style.setProperty("--tron-secondary", "rgba(255,170,60,0.20)");

      root.style.setProperty("--tron-text", "#fff1c0");
      root.style.setProperty("--tron-border", "rgba(255,215,90,0.45)");
    }
    // LOGIN && REGISTE (verde)
    else if (path.startsWith("/login") || path.startsWith("/register")) {

      root.style.setProperty("--tron-primary", "rgba(0,255,140,0.35)");
      root.style.setProperty("--tron-primary-strong", "rgba(0,255,140,0.55)");
      root.style.setProperty("--tron-glow", "rgba(0,255,140,0.75)");
      root.style.setProperty("--tron-secondary", "rgba(0,242,255,0.12)");

      root.style.setProperty("--tron-text", "#baffd8");
      root.style.setProperty("--tron-border", "rgba(0,255,140,0.45)");
    }
    // DEFAULT (landing / resto)
    else {

      root.style.setProperty("--tron-primary", "rgba(0,242,255,0.35)");
      root.style.setProperty("--tron-primary-strong", "rgba(0,242,255,0.55)");
      root.style.setProperty("--tron-glow", "rgba(0,242,255,0.65)");
      root.style.setProperty("--tron-secondary", "rgba(255,170,0,0.12)");

      root.style.setProperty("--tron-text", "#d8fbff");
      root.style.setProperty("--tron-border", "rgba(0,242,255,0.45)");
    }

  }, [location.pathname]);
}