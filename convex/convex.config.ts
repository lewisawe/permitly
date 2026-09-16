import { defineApp } from "convex/server";
import staticHosting from "@convex-dev/static-hosting/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";

// Static hosting for the Vite frontend, served at https://<deployment>.convex.site.
// "keep app HTTP routes at root" mode: our own convex/http.ts routes (the
// AgentMail webhook at /agentmail/webhook) stay at the root; the static site is
// served via registerStaticRoutes in http.ts as a fallback.
const app = defineApp();
app.use(staticHosting);
// Rate limiter: caps how often a renewal (a real, credit-costing Firecrawl web
// action) can be started per business.
app.use(rateLimiter);

export default app;
