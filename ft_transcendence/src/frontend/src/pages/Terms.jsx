import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import LightCycles from "../components/LightCycles";

export default function TermsPage() {
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
        <section className="neon-panel w-full p-6 sm:p-10">
          <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-100/70">Legal</p>
          <h1 className="neon-title mt-3 text-3xl uppercase tracking-[0.16em] text-gridBlue sm:text-4xl">
            Terms and Conditions
          </h1>
          <p className="mt-4 text-sm uppercase tracking-[0.16em] text-cyan-100/70">
            Effective date: March 17, 2026
          </p>

          <div className="mt-8 space-y-6 text-sm leading-7 text-cyan-100/90 sm:text-base">
            <section>
              <h2 className="text-xs uppercase tracking-[0.24em] text-cyan-100">1. Service Scope</h2>
              <p className="mt-2">
                This platform provides access to game, chat, and account-related features. Access may be
                changed, restricted, or interrupted at any time while the project evolves.
              </p>
            </section>

            <section>
              <h2 className="text-xs uppercase tracking-[0.24em] text-cyan-100">2. User Responsibilities</h2>
              <p className="mt-2">
                You agree to provide accurate account data, keep your credentials private, and avoid misuse,
                abuse, or unauthorized attempts to access systems and other accounts.
              </p>
            </section>

            <section>
              <h2 className="text-xs uppercase tracking-[0.24em] text-cyan-100">3. Acceptable Conduct</h2>
              <p className="mt-2">
                Harassment, spam, and disruptive behavior are not allowed. Content or behavior that harms the
                service or other users may result in moderation or account suspension.
              </p>
            </section>

            <section>
              <h2 className="text-xs uppercase tracking-[0.24em] text-cyan-100">4. Availability</h2>
              <p className="mt-2">
                The service is provided as-is during development. We do not guarantee uninterrupted availability,
                data permanence, or feature stability at this stage.
              </p>
            </section>

            <section>
              <h2 className="text-xs uppercase tracking-[0.24em] text-cyan-100">5. Updates to Terms</h2>
              <p className="mt-2">
                These terms may be updated as the product matures. Continued use after updates means acceptance
                of the latest published version.
              </p>
            </section>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
