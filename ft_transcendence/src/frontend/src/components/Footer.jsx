import { ShieldCheck, ShieldEllipsis } from "lucide-react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="relative z-20 border-t border-cyan-300/30 bg-[#05070d]/80 px-4 py-5 backdrop-blur-sm sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-100/60">
          System Sub-Routines
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
