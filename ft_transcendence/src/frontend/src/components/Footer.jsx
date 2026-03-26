import { Link } from "react-router-dom";
import { ShieldCheck, ShieldEllipsis } from "lucide-react";

export default function Footer() {
  return (
    <footer className="relative z-20 border-t border-cyan-500/20 bg-[#05070d]/90 px-4 py-4 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
        
        {/* Bloque Izquierdo - flex-1 asegura que ocupe el mismo espacio que el derecho */}
        <div className="flex flex-1 items-center justify-start">
          <Link
            to="/credits"
            className="neon-profile-pulse group text-[10px] uppercase tracking-widest py-1 px-3 border border-cyan-500/30 rounded-sm hover:bg-cyan-500/10 transition-all"
          >
            Credits
          </Link>
        </div>

        {/* Bloque Central */}
        <p className="flex-1 text-center text-[9px] uppercase tracking-[0.4em] text-cyan-500/50 font-mono whitespace-nowrap">
          [ Welcome to the Tron Matrix v1.0 ]
        </p>

        {/* Bloque Derecho - flex-1 para equilibrio simétrico */}
        <nav className="flex flex-1 items-center justify-end gap-6">
          <Link to="/terms" className="subroutine-link flex items-center gap-2 text-[10px] uppercase tracking-wider text-cyan-500/70 hover:text-cyan-400 transition-colors">
            <ShieldCheck size={14} />
            <span className="hidden md:inline">Terms & Conditions</span>
          </Link>
          <Link to="/privacy" className="subroutine-link flex items-center gap-2 text-[10px] uppercase tracking-wider text-cyan-500/70 hover:text-cyan-400 transition-colors">
            <ShieldEllipsis size={14} />
            <span className="hidden md:inline">Privacy Policy</span>
          </Link>
        </nav>

      </div>
    </footer>
  );
}