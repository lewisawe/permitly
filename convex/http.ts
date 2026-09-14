import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

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
      const inboxId = message.inbox_id;
      const from = message.from ?? "";
      const subject = message.subject ?? "";
      if (inboxId && from) {
        await ctx.runAction(internal.email.replyAck, {
          inboxId: String(inboxId),
          to: String(from),
          subject: `Re: ${subject}`,
        });
      }
    }

    // Always 200 so AgentMail doesn't retry a parsed-but-ignored event.
    return new Response("ok", { status: 200 });
  }),
});

export default http;
