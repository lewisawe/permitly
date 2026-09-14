import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import "./App.css";

function App() {
  const health = useQuery(api.health.health);

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="brand">Permitly</span>
        <span className="brand-tag">compliance on autopilot</span>
      </header>
      <main className="app-main">
        <div className="status-line" role="status">
          {health === undefined ? (
            <span>Connecting to Convex…</span>
          ) : (
            <span>
              Backend live: {health.service} · reactive at{" "}
              {new Date(health.now).toLocaleTimeString()}
            </span>
          )}
        </div>
        <p className="placeholder">
          Compliance board coming next. See DESIGN.md.
        </p>
      </main>
    </div>
  );
}

export default App;
