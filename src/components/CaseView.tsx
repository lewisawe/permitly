import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { STATUS_LABEL, STATUS_TONE, type PermitStatus } from "../lib/status";
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
  const approve = useMutation(api.cases.approve);

  if (data === undefined) {
    return (
      <div className="status-line" role="status">
        Loading case…
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
          <p className="cell-muted">{permit?.agency}</p>
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

      <div className="case-grid">
        {/* Step plan */}
        <section className="panel">
          <h3>Plan</h3>
          <ol className="step-list">
            {steps
              .sort((a, b) => a.order - b.order)
              .map((s) => (
                <li key={s._id} className={`step step-${s.status}`}>
                  <span className="step-ic" aria-hidden="true">
                    {STEP_ICON[s.status]}
                  </span>
                  <span>{s.detail}</span>
                </li>
              ))}
          </ol>
        </section>

        {/* Timeline */}
        <section className="panel">
          <h3>Activity</h3>
          <ul className="turn-list">
            {turns.map((t) => (
              <li key={t._id} className={`turn turn-${t.direction}`}>
                <span className="turn-ic" aria-hidden="true">
                  {TURN_ICON[t.direction]}
                </span>
                <span>{t.summary}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Live view */}
        <section className="panel panel-wide">
          <h3>
            <Bot size={16} aria-hidden="true" /> Agent live view
          </h3>
          {c.liveViewUrl ? (
            <iframe
              className="live-view"
              src={c.liveViewUrl}
              title="Firecrawl live view"
            />
          ) : (
            <div className="live-view-placeholder">
              The agent's browser session will appear here when it starts working
              on the portal.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
