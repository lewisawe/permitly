import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  STATUS_LABEL,
  STATUS_TONE,
  deadlineInfo,
  type PermitStatus,
} from "../lib/status";
import {
  FileCheck2,
  AlarmClock,
  BellRing,
  BadgeCheck,
  X,
  RotateCcw,
  Globe,
} from "lucide-react";

function StatusPill({ status }: { status: PermitStatus }) {
  return (
    <span className={`pill pill-${STATUS_TONE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function Kpi({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="kpi">
      <span className="kpi-icon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <div className="kpi-value">{value}</div>
        <div className="kpi-label">{label}</div>
      </div>
    </div>
  );
}

export function Board({ onOpenCase }: { onOpenCase: (id: Id<"cases">) => void }) {
  const board = useQuery(api.permits.board, {});
  const seed = useMutation(api.seed.demo);
  const startRenewal = useMutation(api.permits.startRenewal);
  const resetDemo = useMutation(api.seed.resetCases);
  const [toast, setToast] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const loading = board === undefined;
  const permits = board?.permits ?? [];
  const business = board?.business;

  const dueSoon = permits.filter((p) => {
    const u = deadlineInfo(p.deadline).urgency;
    return u === "soon" || u === "past";
  }).length;
  const needsYou = permits.filter(
    (p) => p.status === "awaiting_info" || p.status === "awaiting_approval",
  ).length;
  const renewed = permits.filter((p) => p.status === "renewed").length;

  async function handleRenew(permitId: Id<"permits">) {
    try {
      const caseId = await startRenewal({ permitId });
      onOpenCase(caseId);
    } catch (err) {
      // Surface the rate-limit (or any server) message as an in-app toast.
      const msg =
        err && typeof err === "object" && "data" in err
          ? String((err as { data: unknown }).data)
          : "Could not start the renewal. Please try again.";
      setToast(msg);
      window.setTimeout(() => setToast(null), 5000);
    }
  }

  async function handleReset() {
    setResetting(true);
    try {
      await resetDemo({});
      setToast("Demo reset — the board is fresh for the next visitor.");
    } catch {
      setToast("Could not reset the demo. Please try again.");
    } finally {
      setResetting(false);
      window.setTimeout(() => setToast(null), 4000);
    }
  }

  if (loading) {
    return (
      <div aria-busy="true" aria-label="Loading your compliance board">
        <section className="kpis">
          <div className="kpis-live" aria-hidden="true">
            <span className="live-dot" /> Live
          </div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="kpi">
              <div className="skeleton skeleton-kpi-ic" />
              <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-line" style={{ width: "48px", height: "32px" }} />
                <div className="skeleton skeleton-line" style={{ width: "70%", marginTop: 8 }} />
              </div>
            </div>
          ))}
        </section>
        <section>
          <div className="permit-table" style={{ padding: "8px 0" }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton-row">
                <div className="skeleton skeleton-line" style={{ width: "40%" }} />
                <div className="skeleton skeleton-line" style={{ width: "20%" }} />
                <div className="skeleton skeleton-line" style={{ width: "16%" }} />
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (permits.length === 0) {
    return (
      <div className="empty">
        <h2>No permits tracked yet</h2>
        <p>
          Forward a renewal email to your Permitly inbox, or load a demo business
          to see the board in action.
        </p>
        <button className="btn btn-accent" onClick={() => void seed({})}>
          Load demo business
        </button>
      </div>
    );
  }

  return (
    <>
      {toast && (
        <div className="toast" role="alert">
          <span>{toast}</span>
          <button
            className="toast-close"
            onClick={() => setToast(null)}
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      )}
      <div className="board-head">
        <div>
          <h1 className="board-title">Compliance board</h1>
          <p className="board-subtitle">
            {business?.name
              ? `${business.name} — every permit, deadline and renewal in one place.`
              : "Every permit, deadline and renewal in one place."}
          </p>
        </div>
        <button
          className="btn btn-ghost btn-sm reset-demo-btn"
          onClick={() => void handleReset()}
          disabled={resetting}
          title="Clear all runs and re-arm the demo board for the next visitor"
        >
          <RotateCcw size={15} aria-hidden="true" />
          {resetting ? "Resetting…" : "Reset demo"}
        </button>
      </div>

      <section className="kpis" aria-label="Summary">
        <div className="kpis-live" aria-hidden="true">
          <span className="live-dot" /> Live
        </div>
        <Kpi icon={<FileCheck2 size={20} />} value={permits.length} label="Permits tracked" />
        <Kpi icon={<AlarmClock size={20} />} value={dueSoon} label="Due soon / overdue" />
        <Kpi icon={<BellRing size={20} />} value={needsYou} label="Needs you" />
        <Kpi icon={<BadgeCheck size={20} />} value={renewed} label="Renewed" />
      </section>

      <section aria-label="Permits">
        <div className="table-wrap">
        <table className="permit-table">
          <thead>
            <tr>
              <th>Permit</th>
              <th>Agency</th>
              <th>Deadline</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {permits.map((p) => {
              const d = deadlineInfo(p.deadline);
              const active = p.activeCase;
              const needsYou =
                p.status === "awaiting_info" || p.status === "awaiting_approval";
              const isLive = p.portalSlug === "live-demo";
              return (
                <tr key={p._id} className={needsYou ? "row-needs-you" : undefined}>
                  <td className="cell-type">
                    {p.type}
                    {isLive && (
                      <span className="live-badge" title="Runs against a real external website (automationexercise.com) using natural-language browser automation. Takes about 2 minutes and performs a real submission.">
                        <Globe size={12} aria-hidden="true" />
                        Live external site · ~2 min
                      </span>
                    )}
                  </td>
                  <td className="cell-muted">{p.agency}</td>
                  <td className={`cell-deadline urgency-${d.urgency}`}>{d.label}</td>
                  <td>
                    <StatusPill status={p.status as PermitStatus} />
                  </td>
                  <td className="cell-action">
                    {active ? (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => onOpenCase(active._id)}
                      >
                        View case
                      </button>
                    ) : (
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => void handleRenew(p._id)}
                        title={
                          isLive
                            ? "Drives a real external site end to end (~2 min). The fast mock rows above tell the full permit story instantly."
                            : undefined
                        }
                      >
                        {isLive ? "Run live demo" : "Renew"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </section>
    </>
  );
}
