import { defineApp } from "convex/server";

// No components in use yet. We call AgentMail and Firecrawl REST APIs directly
// from Convex actions (the @agentmail/convex@0.1.0 component had unresolvable
// lib functions; direct REST is more reliable and gives full control).
const app = defineApp();

export default app;
