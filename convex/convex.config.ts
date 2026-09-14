import { defineApp } from "convex/server";
import staticHosting from "@convex-dev/static-hosting/convex.config";

// Static hosting for the Vite frontend, served at https://<deployment>.convex.site.
// "keep app HTTP routes at root" mode: our own convex/http.ts routes (the
// AgentMail webhook at /agentmail/webhook) stay at the root; the static site is
// served via registerStaticRoutes in http.ts as a fallback.
const app = defineApp();
app.use(staticHosting);

export default app;
