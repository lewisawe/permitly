import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import {
  STATUS_LABEL,
  STATUS_TONE,
  deadlineInfo,
  type PermitStatus,
} from "./lib/status";
import {
  FileCheck2,
  AlarmClock,
  BellRing,
  BadgeCheck,
  Building2,
} from "lucide-react";
import "./App.css";

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

function App() {
  const board = useQuery(api.permits.board, {});
  const seed = useMutation(api.seed.demo);

  const loading = board === undefined;
  const permits = board?.permits ?? [];
  const business = board?.business;

  const dueSoon = permits.filter(
    (p) => deadlineInfo(p.deadline).urgency === "soon" || deadlineInfo(p.deadline).urgency === "past",
  ).length;
  const needsYou = permits.filter(
    (p) => p.status === "awaiting_info" || p.status === "awaiting_approval",
  ).length;
  const renewed = permits.filter((p) => p.status === "renewed").length;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <span className="brand">Permitly</span>
          <span className="brand-tag">compliance on autopilot</span>
        </div>
        {business && (
          <span className="biz" title="Active business">
            <Building2 size={16} aria-hidden="true" /> {business.name}
          </span>
        )}
      </header>

      <main className="app-main">
        {loading ? (
          <div className="status-line" role="status">
            Loading your compliance board…
          </div>
        ) : !business || permits.length === 0 ? (
          <div className="empty">
            <h2>No permits tracked yet</h2>
            <p>
              Forward a renewal email to your Permitly inbox, or load a demo
              business to see the board in action.
            </p>
            <button className="btn btn-accent" onClick={() => void seed({})}>
              Load demo business
            </button>
          </div>
        ) : (
          <>
            <section className="kpis" aria-label="Summary">
              <Kpi
                icon={<FileCheck2 size={20} />}
                value={permits.length}
                label="Permits tracked"
              />
              <Kpi
                icon={<AlarmClock size={20} />}
                value={dueSoon}
                label="Due soon / overdue"
              />
              <Kpi
                icon={<BellRing size={20} />}
                value={needsYou}
                label="Needs you"
              />
              <Kpi
                icon={<BadgeCheck size={20} />}
                value={renewed}
                label="Renewed"
              />
            </section>

            <section aria-label="Permits">
              <table className="permit-table">
                <thead>
                  <tr>
                    <th>Permit</th>
                    <th>Agency</th>
                    <th>Deadline</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {permits.map((p) => {
                    const d = deadlineInfo(p.deadline);
                    return (
                      <tr key={p._id}>
                        <td className="cell-type">{p.type}</td>
                        <td className="cell-muted">{p.agency}</td>
                        <td className={`cell-deadline urgency-${d.urgency}`}>
                          {d.label}
                        </td>
                        <td>
                          <StatusPill status={p.status as PermitStatus} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
