import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import LightCycles from "../components/LightCycles";

export default function PrivacyPage() {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-voidBlack font-mono text-[color:var(--tron-text)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="grid-atmosphere" />
        <div className="grid-floor" />
        <LightCycles />
        <div className="scanline-overlay" />
      </div>

      <Navbar />

      <main className="relative z-20 mx-auto flex w-full max-w-4xl flex-1 items-start px-4 py-12 sm:px-6 lg:px-8">
        <section className="neon-panel relative w-full p-6 sm:p-10">
          <button
            type="button"
            onClick={() => navigate("/")}
            aria-label="Close"
            className="absolute right-4 top-4 text-red-400/80 transition hover:text-red-300"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
          <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-100/70">Legal</p>
          <h1 className="neon-title mt-3 text-3xl uppercase tracking-[0.16em] text-gridBlue sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm uppercase tracking-[0.16em] text-cyan-100/70">
            Effective date: March 17, 2026
          </p>

          <div className="mt-8 space-y-6 text-sm leading-7 text-cyan-100/90 sm:text-base">
            <section>
              <h2 className="text-xs uppercase tracking-[0.24em] text-cyan-100">1. Data We Collect</h2>
              <p className="mt-2">
                We process account details, authentication metadata, and in-app communication data needed to run
                the platform features.
              </p>
            </section>

            <section>
              <h2 className="text-xs uppercase tracking-[0.24em] text-cyan-100">2. How Data Is Used</h2>
              <p className="mt-2">
                Data is used to authenticate users, provide gameplay and chat functionality, improve reliability,
                and detect abuse or unauthorized behavior.
              </p>
            </section>

            <section>
              <h2 className="text-xs uppercase tracking-[0.24em] text-cyan-100">3. Data Sharing</h2>
              <p className="mt-2">
                We do not sell personal data. Information may be shared only when required for core service
                operation, legal obligations, or security response.
              </p>
            </section>

            <section>
              <h2 className="text-xs uppercase tracking-[0.24em] text-cyan-100">4. Security</h2>
              <p className="mt-2">
                Reasonable technical safeguards are applied, but no system can guarantee absolute security. Users
                are responsible for protecting account credentials.
              </p>
            </section>

            <section>
              <h2 className="text-xs uppercase tracking-[0.24em] text-cyan-100">5. Policy Changes</h2>
              <p className="mt-2">
                This policy may be revised as architecture and features evolve. The current version is published
                on this page and applies from its effective date.
              </p>
            </section>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
