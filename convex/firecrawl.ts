"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";

// Direct Firecrawl v2 REST client. We use scrape + /interact to fill and submit
// real web forms. Base: https://api.firecrawl.dev/v2, Bearer auth.
const BASE = "https://api.firecrawl.dev/v2";

function fcHeaders(): Record<string, string> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY is not set on the deployment.");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function fcFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...fcHeaders(), ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Firecrawl ${init?.method ?? "GET"} ${path} -> ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

// Scrape a page and return its scrapeId (needed to start an interact session).
export const scrape = action({
  args: { url: v.string() },
  handler: async (_ctx, { url }) => {
    const data = await fcFetch("/scrape", {
      method: "POST",
      body: JSON.stringify({ url, formats: ["markdown"] }),
    });
    const scrapeId = data?.data?.metadata?.scrapeId ?? data?.data?.metadata?.scrape_id;
    return { scrapeId, url, markdownLength: data?.data?.markdown?.length ?? 0 };
  },
});

// Run one interact step on a scraped page via a natural-language prompt.
// Returns { output, liveViewUrl, interactiveLiveViewUrl }.
export const interact = action({
  args: { scrapeId: v.string(), prompt: v.string() },
  handler: async (_ctx, { scrapeId, prompt }) => {
    const data = await fcFetch(
      `/scrape/${encodeURIComponent(scrapeId)}/interact`,
      { method: "POST", body: JSON.stringify({ prompt }) },
    );
    return {
      output: data?.output ?? "",
      liveViewUrl: data?.liveViewUrl ?? data?.interactiveLiveViewUrl ?? "",
      interactiveLiveViewUrl: data?.interactiveLiveViewUrl ?? "",
      success: data?.success ?? true,
    };
  },
});

// Stop an interact session. Best-effort: cleanup must never throw (a failed
// stop would otherwise mask the real error and still leak the session slot).
export const stopInteract = action({
  args: { scrapeId: v.string() },
  handler: async (_ctx, { scrapeId }) => {
    try {
      await fcFetch(`/scrape/${encodeURIComponent(scrapeId)}/interact`, {
        method: "DELETE",
      });
      return { stopped: true };
    } catch {
      return { stopped: false };
    }
  },
});

// Run Playwright code on the session (deterministic reads/actions).
// Returns { result, stdout }.
export const interactCode = action({
  args: { scrapeId: v.string(), code: v.string() },
  handler: async (_ctx, { scrapeId, code }) => {
    const data = await fcFetch(
      `/scrape/${encodeURIComponent(scrapeId)}/interact`,
      { method: "POST", body: JSON.stringify({ code, language: "node" }) },
    );
    return {
      result: data?.result ?? "",
      stdout: data?.stdout ?? "",
      liveViewUrl: data?.liveViewUrl ?? data?.interactiveLiveViewUrl ?? "",
    };
  },
});
