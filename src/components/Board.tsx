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
  const [toast, setToast] = useState<string | null>(null);

  const loading = board === undefined;
  const permits = board?.permits ?? [];

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

  if (loading) {
    return (
      <div className="status-line" role="status">
        Loading your compliance board…
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
              return (
                <tr key={p._id} className={needsYou ? "row-needs-you" : undefined}>
                  <td className="cell-type">{p.type}</td>
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
                      >
                        Renew
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
