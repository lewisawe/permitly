import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal, components } from "./_generated/api";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { FOOD_HANDLER_PORTAL } from "./portalHtml";

const http = httpRouter();

// Mock permit portal served publicly from convex.site so Firecrawl can reach it.
http.route({
  path: "/demo-portal/food-handler",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(FOOD_HANDLER_PORTAL, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }),
});

// AgentMail delivers inbound email + delivery events here.
// Minimal first cut: parse the event, and on an inbound message schedule an
// auto-acknowledge reply. Signature verification + real case handling come next.
http.route({
  path: "/agentmail/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    let payload: any = {};
    try {
      payload = await req.json();
    } catch {
      return new Response("bad request", { status: 400 });
    }

    // AgentMail message.received webhook shape (docs.agentmail.to):
    // { type: "event", event_type: "message.received"|..., event_id,
    //   message: { inbox_id, from, subject, text, thread_id, ... }, thread: {...} }
    const eventType = String(payload?.event_type ?? "");
    const message = payload?.message;

    if (eventType.startsWith("message.received") && message) {
      const text = String(message.text ?? message.preview ?? "").trim();
      // Route the reply to the case currently awaiting the owner.
      const c = await ctx.runQuery(internal.cases.findAwaitingCase, {});
      if (c) {
        if (/\bapprove\b/i.test(text)) {
          await ctx.runMutation(internal.cases.approveFromEmail, { caseId: c._id });
        } else {
          await ctx.runAction(internal.runner.handleReply, {
            caseId: c._id,
            replyText: text,
          });
        }
      }
    }

    // Always 200 so AgentMail doesn't retry a parsed-but-ignored event.
    return new Response("ok", { status: 200 });
  }),
});

export default http;

// Serve the static Vite site at the root (fallback for non-/api routes).
// Registered last so our own routes above take precedence.
registerStaticRoutes(http, components.staticHosting);
