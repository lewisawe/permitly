import { useEffect, useState } from "react";
import { Building2, Moon, Sun } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { Board } from "./components/Board";
import { CaseView } from "./components/CaseView";
import "./App.css";

// Minimal hash routing: #/ = board, #/case/<id> = case view.
function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("permitly-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("permitly-theme", theme);
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === "light" ? "dark" : "light")) };
}

function App() {
  const hash = useHashRoute();
  const { theme, toggle } = useTheme();
  const board = useQuery(api.permits.board, {});
  const business = board?.business;

  const caseMatch = hash.match(/^#\/case\/(.+)$/);
  const caseId = caseMatch ? (caseMatch[1] as Id<"cases">) : null;

  const openCase = (id: Id<"cases">) => {
    window.location.hash = `#/case/${id}`;
  };
  const goBoard = () => {
    window.location.hash = "#/";
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <button className="brand-block brand-link" onClick={goBoard}>
          <span className="brand">Permitly</span>
          <span className="brand-tag">compliance on autopilot</span>
        </button>
        {business && (
          <span className="biz" title="Active business">
            <Building2 size={16} aria-hidden="true" /> {business.name}
          </span>
        )}
        <button
          className="theme-toggle"
          onClick={toggle}
          aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          title="Toggle theme"
        >
          {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </header>

      <main className="app-main">
        {caseId ? (
          <CaseView caseId={caseId} onBack={goBoard} />
        ) : (
          <Board onOpenCase={openCase} />
        )}
      </main>
    </div>
  );
}

export default App;
