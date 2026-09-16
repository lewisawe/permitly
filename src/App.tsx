import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { Board } from "./components/Board";
import { CaseView } from "./components/CaseView";
import { Landing } from "./components/Landing";
import "./App.css";

// Minimal hash routing: #/ = landing, #/board = board, #/case/<id> = case view.
function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

function App() {
  const hash = useHashRoute();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();

  // Anonymous sign-in on load: every visitor gets an identity (no account
  // needed), so judges can open the live URL and still get owner-scoped data.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      void signIn("anonymous");
    }
  }, [isLoading, isAuthenticated, signIn]);

  const board = useQuery(api.permits.board, {});
  const business = board?.business;

  const caseMatch = hash.match(/^#\/case\/(.+)$/);
  const caseId = caseMatch ? (caseMatch[1] as Id<"cases">) : null;
  const onBoard = hash === "#/board";
  const isLanding = !caseId && !onBoard;

  const openCase = (id: Id<"cases">) => {
    window.location.hash = `#/case/${id}`;
  };
  const goBoard = () => {
    window.location.hash = "#/board";
  };
  const goHome = () => {
    window.location.hash = "#/";
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <button className="brand-block brand-link" onClick={goHome}>
          <span className="brand">Permitly</span>
          <span className="brand-tag">/ compliance on autopilot</span>
        </button>
        {!isLanding && business ? (
          <span className="biz" title="Active business">
            <Building2 size={15} aria-hidden="true" /> {business.name}
          </span>
        ) : (
          isLanding && (
            <button className="btn btn-outline btn-sm" onClick={goBoard}>
              Open the board
            </button>
          )
        )}
      </header>

      <main className={isLanding ? "app-main app-main-wide" : "app-main"}>
        {caseId ? (
          <CaseView caseId={caseId} onBack={goBoard} />
        ) : onBoard ? (
          <Board onOpenCase={openCase} />
        ) : (
          <Landing onEnter={goBoard} />
        )}
      </main>
    </div>
  );
}

export default App;
