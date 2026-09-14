import { query } from "./_generated/server";

// Simple health check so we can verify the deployment is live and reactive
// before wiring real features. Returns a static payload + server time.
export const health = query({
  args: {},
  handler: async () => {
    return { ok: true, service: "permitly", now: Date.now() };
  },
});
