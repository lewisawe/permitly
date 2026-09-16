import {
  Mail,
  Bot,
  ShieldCheck,
  BadgeCheck,
  ArrowRight,
  FileCheck2,
  CalendarClock,
} from "lucide-react";

// Landing / front door. Explains Permitly before the dashboard. On-system
// (Timescale): warm paper, hard offset shadows, orange emphasis, chartreuse
// spotlight. The primary CTA drops the visitor onto the live demo board.
export function Landing({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="landing">
      {/* Hero */}
      <section className="hero">
        <span className="hero-eyebrow">Compliance on autopilot</span>
        <h1 className="hero-title">
          Forward one email. Your permits{" "}
          <span className="hero-accent">renew themselves.</span>
        </h1>
        <p className="hero-sub">
          Permitly is an agent that renews a small business's licenses and
          permits end to end — it signs in to the portal, fills the form, books
          the inspection, and submits after you approve. You approve every real
          action.
        </p>
        <div className="hero-cta">
          <button className="btn btn-accent" onClick={onEnter}>
            See the live board <ArrowRight size={16} aria-hidden="true" />
          </button>
          <span className="hero-note">No account needed — it's a live demo.</span>
        </div>
      </section>

      {/* How it works */}
      <section className="how">
        <h2 className="section-title">How it works</h2>
        <ol className="how-steps">
          <li className="how-step">
            <span className="how-ic" aria-hidden="true"><Mail size={20} /></span>
            <h3>1 · Ask by email</h3>
            <p>Forward "renew my food-handler permit" — or start it on the board.</p>
          </li>
          <li className="how-step">
            <span className="how-ic" aria-hidden="true"><Bot size={20} /></span>
            <h3>2 · The agent works</h3>
            <p>It opens the official portal, fills the form, and books the inspection — live, on screen.</p>
          </li>
          <li className="how-step">
            <span className="how-ic" aria-hidden="true"><ShieldCheck size={20} /></span>
            <h3>3 · You approve</h3>
            <p>Nothing submits until you say yes — by email or one click.</p>
          </li>
          <li className="how-step">
            <span className="how-ic" aria-hidden="true"><BadgeCheck size={20} /></span>
            <h3>4 · Renewed</h3>
            <p>It submits, captures the confirmation number, and files your receipt.</p>
          </li>
        </ol>
      </section>

      {/* Value row */}
      <section className="value">
        <div className="value-card">
          <FileCheck2 size={18} aria-hidden="true" />
          <h3>Never miss a deadline</h3>
          <p>Every permit, agency and due date on one live board — with a daily deadline watch.</p>
        </div>
        <div className="value-card">
          <CalendarClock size={18} aria-hidden="true" />
          <h3>It does the busywork</h3>
          <p>The same forms, filled from your business profile, every renewal cycle.</p>
        </div>
        <div className="value-card">
          <ShieldCheck size={18} aria-hidden="true" />
          <h3>You stay in control</h3>
          <p>A human approves every submission and can take over the browser at any time.</p>
        </div>
      </section>

      {/* CTA footer */}
      <section className="landing-cta">
        <div className="landing-cta-inner">
          <div>
            <h2>See it renew a permit</h2>
            <p>Open the board, hit Renew, and watch the agent work.</p>
          </div>
          <button className="btn btn-accent" onClick={onEnter}>
            Open the board <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
        <p className="landing-demo-note">
          Demo target is a controlled mock "Springfield City Permits" portal,
          clearly labeled. The agent's web actions, emails, and AI are real.
        </p>
      </section>
    </div>
  );
}
