import { ShieldCheck, ShieldEllipsis } from "lucide-react"; 
import Button from "./Button.jsx";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="relative z-20 border-t border-cyan-500/20 bg-[#05070d]/90 px-4 py-4 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
        
        {/* Botón de Créditos - Ajustado flex para alineación */}
        <div className="flex flex-1 items-center justify-start">
          <Button
            to="/credits"
            className="neon-profile-pulse group text-[10px] uppercase tracking-widest py-1 px-3" 
          >
            Credits
          </Button>
        </div>

        {/* Texto Central - Se mantiene igual pero con menos aire arriba/abajo */}
        <p className="flex-1 text-center text-[9px] uppercase tracking-[0.4em] text-cyan-500/50 font-mono">
          [ Welcome to the Tron Matrix v1.0 ]
        </p>

        <nav className="flex items-center gap-4 sm:gap-5">
          <Link to="/terms" className="subroutine-link">
            <ShieldCheck size={14} />
            Terms &amp; Conditions
          </Link>
          <Link to="/privacy" className="subroutine-link">
            <ShieldEllipsis size={14} />
            Privacy Policy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
