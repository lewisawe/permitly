"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";

// Direct AgentMail REST client (https://api.agentmail.to/v0), Bearer auth.
// We call this from Convex actions rather than the @agentmail/convex component,
// whose v0.1.0 lib functions did not resolve at runtime.
const BASE = "https://api.agentmail.to/v0";

function authHeaders(): Record<string, string> {
  const key = process.env.AGENTMAIL_API_KEY;
  if (!key) throw new Error("AGENTMAIL_API_KEY is not set on the deployment.");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function agentmailFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`AgentMail ${init?.method ?? "GET"} ${path} -> ${res.status}: ${bodyText}`);
  }
  return bodyText ? JSON.parse(bodyText) : {};
}

// Create an inbox. Returns { inbox_id, ... }.
export const createInbox = action({
  args: { username: v.optional(v.string()), displayName: v.optional(v.string()) },
  handler: async (_ctx, { username, displayName }) => {
    const body: Record<string, unknown> = {};
    if (username) body.username = username;
    if (displayName) body.display_name = displayName;
    return await agentmailFetch("/inboxes", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
});

// List inboxes.
export const listInboxes = action({
  args: {},
  handler: async () => {
    return await agentmailFetch("/inboxes");
  },
});

// Send a message from an inbox.
export const send = action({
  args: {
    inboxId: v.string(),
    to: v.string(),
    subject: v.string(),
    text: v.string(),
  },
  handler: async (_ctx, { inboxId, to, subject, text }) => {
    return await agentmailFetch(
      `/inboxes/${encodeURIComponent(inboxId)}/messages/send`,
      {
        method: "POST",
        body: JSON.stringify({ to, subject, text }),
      },
    );
  },
});
