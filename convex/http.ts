import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal, components, api } from "./_generated/api";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { FOOD_HANDLER_PORTAL, BOOKING_PORTAL, LOGIN_PORTAL, DASHBOARD_PORTAL, REVIEW_PORTAL } from "./portalHtml";
import { auth } from "./auth";

const http = httpRouter();

// Convex Auth HTTP routes (token issuance/verification for anonymous sign-in).
auth.addHttpRoutes(http);

// Verify a Svix-signed webhook (AgentMail uses Svix). The signed content is
// `${id}.${timestamp}.${body}`; the secret is base64 after the "whsec_" prefix;
// the signature header holds one or more space-separated "v1,<b64>" entries.
// Uses Web Crypto (this file is not a "use node" module).
async function verifySvix(req: Request, body: string, secret: string): Promise<boolean> {
  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const sigHeader = req.headers.get("svix-signature");
  if (!id || !timestamp || !sigHeader) return false;

  // Reject stale timestamps (>5 min skew) to blunt replay.
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const secretBytes = base64ToBytes(secret.replace(/^whsec_/, ""));
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = `${id}.${timestamp}.${body}`;
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed));
  const expected = bytesToBase64(new Uint8Array(mac));

  // The header can carry multiple versioned signatures; match any v1 entry.
  for (const part of sigHeader.split(" ")) {
    const [version, value] = part.split(",");
    if (version === "v1" && value && timingSafeEqual(value, expected)) return true;
  }
  return false;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

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

// Mock inspection booking page (for permits that require an inspection).
http.route({
  path: "/demo-portal/booking",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(BOOKING_PORTAL, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }),
});

// Multi-page portal: login -> dashboard -> (form) -> review. Proves the agent
// can sign in and navigate, not just fill one known form.
const htmlResponse = (body: string) =>
  new Response(body, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });

http.route({ path: "/demo-portal/login", method: "GET", handler: httpAction(async () => htmlResponse(LOGIN_PORTAL)) });
// The login form GETs the dashboard; accept it as the entry to the signed-in area.
http.route({ path: "/demo-portal/dashboard", method: "GET", handler: httpAction(async () => htmlResponse(DASHBOARD_PORTAL)) });
http.route({ path: "/demo-portal/review", method: "GET", handler: httpAction(async () => htmlResponse(REVIEW_PORTAL)) });

// AgentMail delivers inbound email + delivery events here.
// Svix-verified. On an inbound message we route by thread to the owning case and
// either approve (if it's the approval gate) or feed the reply to the runner.
http.route({
  path: "/agentmail/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const raw = await req.text();

    // Verify the Svix signature before trusting anything in the body. AgentMail
    // signs webhooks with Svix (svix-id / svix-timestamp / svix-signature).
    const secret = process.env.AGENTMAIL_WEBHOOK_SECRET;
    if (secret) {
      const ok = await verifySvix(req, raw, secret);
      if (!ok) return new Response("invalid signature", { status: 401 });
    } else {
      // No secret configured: dev only. Never leave this unset in production.
      console.warn("AGENTMAIL_WEBHOOK_SECRET unset; skipping signature check.");
    }

    let payload: any = {};
    try {
      payload = JSON.parse(raw);
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
      const from = String(message.from ?? "").toLowerCase();
      const subject = String(message.subject ?? "").toLowerCase();

      // Ignore delivery-failure bounces: they arrive as inbound messages but must
      // not be parsed as an owner reply. Detect by sender (mailer-daemon /
      // postmaster) or classic bounce markers in the subject/body.
      const looksLikeBounce =
        /mailer-daemon|postmaster|no-?reply/.test(from) ||
        /delivery (status notification|has failed)|undeliverable|returned mail|mail delivery failed|reporting-mta/i.test(
          `${subject}\n${text}`,
        );
      if (looksLikeBounce) {
        return new Response("ignored bounce", { status: 200 });
      }

      const threadId = message.thread_id
        ? String(message.thread_id)
        : payload?.thread?.id
          ? String(payload.thread.id)
          : undefined;

      // Route the reply to the owning case by thread (fallback: newest waiting).
      const c = await ctx.runQuery(internal.cases.routeInbound, { threadId });
      if (c) {
        const isApprove = /\bapprove\b/i.test(text);
        if (isApprove && c.state === "awaiting_approval") {
          await ctx.runMutation(internal.cases.approveFromEmail, { caseId: c._id });
        } else if (c.state === "awaiting_info") {
          await ctx.runAction(internal.runner.handleReply, {
            caseId: c._id,
            replyText: text,
          });
        } else if (isApprove) {
          // "approve" arrived but the case isn't at the gate yet: record it.
          await ctx.runMutation(api.cases.addTurn, {
            caseId: c._id,
            direction: "inbound",
            summary: "Owner said 'approve' but the case isn't ready to submit yet.",
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
