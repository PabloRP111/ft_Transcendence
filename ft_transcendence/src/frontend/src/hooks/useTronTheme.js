import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function useTronTheme() {
  const location = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    const path = location.pathname;

    // PROFILE
    if (path.startsWith("/profile")) {

      root.style.setProperty("--tron-primary", "rgba(255,170,0,0.35)");
      root.style.setProperty("--tron-primary-strong", "rgba(255,170,0,0.55)");
      root.style.setProperty("--tron-glow", "rgba(255,170,0,0.65)");
      root.style.setProperty("--tron-secondary", "rgba(0,242,255,0.12)");

      root.style.setProperty("--tron-text", "#ffd8a0");
      root.style.setProperty("--tron-border", "rgba(255,170,0,0.45)");

    }

    // LOGIN / REGISTER
    else if (path.startsWith("/login") || path.startsWith("/register")) {

      root.style.setProperty("--tron-primary", "rgba(0,255,140,0.35)");
      root.style.setProperty("--tron-primary-strong", "rgba(0,255,170,0.35)");
      root.style.setProperty("--tron-glow", "rgba(0,255,140,0.65)");
      root.style.setProperty("--tron-secondary", "rgba(0,242,255,0.12)");

      root.style.setProperty("--tron-text", "#baffd8");
      root.style.setProperty("--tron-border", "rgba(0,255,140,0.45)");

    }

    // DEFAULT
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