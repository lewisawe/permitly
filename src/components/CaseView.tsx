import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { STATUS_LABEL, STATUS_TONE, deadlineInfo, type PermitStatus } from "../lib/status";
import {
  ArrowLeft,
  Check,
  Circle,
  Loader2,
  CircleAlert,
  Mail,
  Bot,
  Info,
  ShieldCheck,
  Download,
} from "lucide-react";

const STEP_ICON: Record<string, React.ReactNode> = {
  done: <Check size={16} className="step-done" />,
  running: <Loader2 size={16} className="step-running" />,
  blocked: <CircleAlert size={16} className="step-blocked" />,
  pending: <Circle size={16} className="step-pending" />,
};

const TURN_ICON: Record<string, React.ReactNode> = {
  inbound: <Mail size={16} />,
  outbound: <Mail size={16} />,
  system: <Info size={16} />,
};

export function CaseView({
  caseId,
  onBack,
}: {
  caseId: Id<"cases">;
  onBack: () => void;
}) {
  const data = useQuery(api.cases.get, { caseId });
  const receiptUrl = useQuery(api.cases.receiptUrl, { caseId });
  const approve = useMutation(api.cases.approve);

  if (data === undefined) {
    return (
      <div className="case-view" aria-busy="true" aria-label="Loading case">
        <div className="skeleton skeleton-line" style={{ width: "120px", height: "20px" }} />
        <div className="skeleton skeleton-line" style={{ width: "40%", height: "28px", marginTop: 8 }} />
        <div className="case-grid">
          <section className="panel">
            <div className="skeleton skeleton-line" style={{ width: "30%" }} />
            <div className="skeleton skeleton-line" style={{ width: "90%", marginTop: 16 }} />
            <div className="skeleton skeleton-line" style={{ width: "80%", marginTop: 10 }} />
            <div className="skeleton skeleton-line" style={{ width: "85%", marginTop: 10 }} />
          </section>
          <section className="panel">
            <div className="skeleton skeleton-line" style={{ width: "30%" }} />
            <div className="skeleton skeleton-line" style={{ width: "95%", marginTop: 16 }} />
            <div className="skeleton skeleton-line" style={{ width: "70%", marginTop: 10 }} />
          </section>
          <section className="panel panel-wide">
            <div className="skeleton skeleton-line" style={{ width: "30%" }} />
            <div className="skeleton" style={{ height: "300px", marginTop: 16, borderRadius: 8 }} />
          </section>
        </div>
      </div>
    );
  }
  if (data === null) {
    return (
      <div className="empty">
        <h2>Case not found</h2>
        <button className="btn btn-outline" onClick={onBack}>
          Back to board
        </button>
      </div>
    );
  }

  const { case: c, permit, steps, turns, actions } = data;
  const pendingAction =
    c.state === "awaiting_approval"
      ? actions.find((a) => a.status === "proposed")
      : undefined;

  return (
    <div className="case-view">
      <button className="btn btn-ghost btn-sm back-btn" onClick={onBack}>
        <ArrowLeft size={16} /> Board
      </button>

      <div className="case-head">
        <div>
          <h2>{permit?.type ?? "Renewal"}</h2>
          <div className="case-head-meta">
            <span>{permit?.agency}</span>
            {permit && (
              <>
                <span className="case-head-dot" aria-hidden="true">·</span>
                <span className={`urgency-${deadlineInfo(permit.deadline).urgency}`}>
                  {deadlineInfo(permit.deadline).label}
                </span>
              </>
            )}
          </div>
        </div>
        {permit && (
          <span className={`pill pill-${STATUS_TONE[permit.status as PermitStatus]}`}>
            {STATUS_LABEL[permit.status as PermitStatus]}
          </span>
        )}
      </div>

      {pendingAction && (
        <div className="approval-bar" role="region" aria-label="Approval required">
          <div className="approval-text">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>{pendingAction.payloadSummary} Approve to submit.</span>
          </div>
          <button
            className="btn btn-accent"
            onClick={() => void approve({ caseId, approvedBy: "owner (app)" })}
          >
            Approve &amp; submit
          </button>
        </div>
      )}

      {c.state === "done" && receiptUrl && (
        <div className="receipt-bar">
          <span className="receipt-text">
            <ShieldCheck size={16} aria-hidden="true" /> Renewal complete
            {permit?.lastConfirmation ? ` — ${permit.lastConfirmation}` : ""}
          </span>
          <a
            className="btn btn-outline btn-sm"
            href={receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            download
          >
            <Download size={15} aria-hidden="true" /> Download receipt
          </a>
        </div>
      )}

      <div className="case-grid">
        {/* Step plan */}
        <section className="panel">
          {(() => {
            const sorted = [...steps].sort((a, b) => a.order - b.order);
            const doneCount = sorted.filter((s) => s.status === "done").length;
            const total = sorted.length || 8;
            const pct = Math.round((doneCount / total) * 100);
            return (
              <>
                <h3>
                  Plan
                  <span className="step-count">
                    {Math.min(doneCount + 1, total)} of {total}
                  </span>
                </h3>
                <div className="progress-track" aria-hidden="true">
                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <ol className="step-list">
                  {sorted.map((s) => (
                    <li key={s._id} className={`step step-${s.status}`}>
                      <span className="step-ic" aria-hidden="true">
                        {STEP_ICON[s.status]}
                      </span>
                      <span>{s.detail}</span>
                    </li>
                  ))}
                </ol>
              </>
            );
          })()}
        </section>

        {/* Timeline */}
        <section className="panel">
          <h3>Activity</h3>
          <ul className="turn-list">
            {turns.map((t) => {
              const isEmail =
                (t.direction === "outbound" || t.direction === "inbound") &&
                /email|replied|approve|renewal|permit|detail|owner/i.test(t.summary);
              if (isEmail) {
                const outbound = t.direction === "outbound";
                return (
                  <li key={t._id} className="turn turn-animate">
                    <div className={`email-card ${outbound ? "email-out" : "email-in"}`}>
                      <div className="email-meta">
                        <Mail size={13} aria-hidden="true" />
                        <span>
                          {outbound ? "Permitly → owner" : "Owner → Permitly"}
                        </span>
                      </div>
                      <div className="email-body">{t.summary}</div>
                    </div>
                  </li>
                );
              }
              return (
                <li key={t._id} className={`turn turn-${t.direction} turn-animate`}>
                  <span className="turn-ic" aria-hidden="true">
                    {TURN_ICON[t.direction]}
                  </span>
                  <span>{t.summary}</span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Live view */}
        <section className="panel panel-wide">
          <h3>
            <Bot size={16} aria-hidden="true" /> Agent live view
          </h3>
          <LiveView state={c.state} liveViewUrl={c.liveViewUrl} permit={permit} />
        </section>
      </div>
    </div>
  );
}

// State-aware live view: shows the Firecrawl browser when a session is active,
// and a clear, labeled status the rest of the time so the panel is never blank.
const LIVE_MESSAGE: Record<string, { title: string; body: string; tone: string }> = {
  intake: { title: "Opening the case…", body: "Setting up the renewal.", tone: "working" },
  planning: { title: "Planning the renewal…", body: "Working out the steps.", tone: "working" },
  finding_page: { title: "Opening the portal…", body: "The agent is logging in and finding the renewal page.", tone: "working" },
  reading_form: { title: "Reading the form…", body: "The agent is inspecting the fields on the page.", tone: "working" },
  filling_form: { title: "Filling the form…", body: "Watch the agent type each field on the live page.", tone: "working" },
  awaiting_info: { title: "Paused — waiting for your reply", body: "The agent emailed you for one missing detail and is waiting for your response.", tone: "waiting" },
  booking_slot: { title: "Booking the inspection…", body: "The agent is choosing an appointment slot.", tone: "working" },
  awaiting_approval: { title: "Ready to submit — waiting for approval", body: "The agent has everything it needs. Approve to let it submit.", tone: "waiting" },
  submitting: { title: "Submitting the renewal…", body: "The agent is submitting the form and reading the confirmation.", tone: "working" },
  recording: { title: "Recording the receipt…", body: "Saving the confirmation number.", tone: "working" },
  done: { title: "Renewal complete", body: "The permit is renewed and the confirmation is recorded.", tone: "done" },
  blocked: { title: "Needs attention", body: "The agent hit a problem and has paused.", tone: "blocked" },
};

function LiveView({
  state,
  liveViewUrl,
  permit,
}: {
  state: string;
  liveViewUrl?: string;
  permit: { lastConfirmation?: string } | null;
}) {
  const msg = LIVE_MESSAGE[state] ?? LIVE_MESSAGE.intake;
  // Show the real browser whenever a session URL exists and the agent is actively
  // driving it (not while paused for a human or finished).
  const activeStates = ["finding_page", "reading_form", "filling_form", "booking_slot", "submitting"];
  const showFrame = !!liveViewUrl && activeStates.includes(state);

  if (showFrame) {
    return (
      <>
        <p className="live-view-hint">
          Watch the agent open the portal and act on the form. You can take over
          in this window at any time.
        </p>
        <iframe className="live-view" src={liveViewUrl} title="Firecrawl live view" />
      </>
    );
  }

  return (
    <div className={`live-status live-status-${msg.tone}`} role="status">
      <div className="live-status-icon" aria-hidden="true">
        {msg.tone === "waiting" ? (
          <Mail size={22} />
        ) : msg.tone === "done" ? (
          <ShieldCheck size={22} />
        ) : msg.tone === "blocked" ? (
          <CircleAlert size={22} />
        ) : (
          <Loader2 size={22} className="step-running" />
        )}
      </div>
      <div className="live-status-title">{msg.title}</div>
      <div className="live-status-body">{msg.body}</div>
      {state === "done" && permit?.lastConfirmation && (
        <div className="live-status-conf">
          Confirmation <span>{permit.lastConfirmation}</span>
        </div>
      )}
    </div>
  );
}
