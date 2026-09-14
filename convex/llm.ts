"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";
import crypto from "node:crypto";

// Minimal AWS SigV4 signer for Bedrock Runtime Converse, so Convex (cloud) can
// call Bedrock with the simi-ops credentials stored as deployment env vars.
// No AWS SDK needed; we sign the request ourselves.

function hmac(key: crypto.BinaryLike | crypto.KeyObject, data: string) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}
function sha256Hex(data: string) {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

function signingKey(secret: string, date: string, region: string, service: string) {
  const kDate = hmac("AWS4" + secret, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

async function bedrockConverse(messagesText: string, system?: string) {
  const region = process.env.AWS_REGION ?? "us-east-1";
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const modelId = process.env.BEDROCK_MODEL_ID ?? "amazon.nova-lite-v1:0";
  if (!accessKey || !secretKey) {
    throw new Error("AWS credentials are not set on the deployment.");
  }

  const service = "bedrock";
  const host = `bedrock-runtime.${region}.amazonaws.com`;
  // The actual request path uses standard encoding of the model id.
  const requestPath = `/model/${encodeURIComponent(modelId)}/converse`;
  // SigV4 (non-S3) URI-encodes the path AGAIN for the canonical request, so the
  // ':' in the model id becomes %253A in the string that gets signed.
  const canonicalPath = `/model/${encodeURIComponent(encodeURIComponent(modelId))}/converse`;

  const body = JSON.stringify({
    messages: [{ role: "user", content: [{ text: messagesText }] }],
    ...(system ? { system: [{ text: system }] } : {}),
    inferenceConfig: { maxTokens: 1024, temperature: 0.2 },
  });

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = sha256Hex(body);
  const canonicalHeaders =
    `content-type:application/json\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "POST",
    canonicalPath,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const sig = crypto
    .createHmac("sha256", signingKey(secretKey, dateStamp, region, service))
    .update(stringToSign, "utf8")
    .digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${sig}`;

  const res = await fetch(`https://${host}${requestPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Amz-Date": amzDate,
      "X-Amz-Content-Sha256": payloadHash,
      Authorization: authorization,
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Bedrock ${res.status}: ${text}`);
  const json = JSON.parse(text);
  return json?.output?.message?.content?.[0]?.text ?? "";
}

// Public test action: prove Bedrock works from the deployment.
export const ping = action({
  args: { prompt: v.optional(v.string()) },
  handler: async (_ctx, { prompt }) => {
    const out = await bedrockConverse(prompt ?? "Reply with exactly: PERMITLY_OK");
    return { text: out };
  },
});

// Ask the model to map a business profile onto a set of form field names.
// Returns a JSON object { fieldName: value } plus a list of missing fields.
export const fillFields = action({
  args: {
    fields: v.array(v.string()),
    profile: v.record(v.string(), v.string()),
  },
  handler: async (_ctx, { fields, profile }): Promise<{ values: Record<string, string>; missing: string[] }> => {
    const system =
      "You map a small business's stored profile onto a web form. " +
      "Return ONLY compact JSON: {\"values\":{field:value,...},\"missing\":[field,...]}. " +
      "Use a profile value only when it clearly matches the field. If no profile " +
      "value fits a required field, put it in missing and omit it from values.";
    const prompt =
      `Form fields: ${JSON.stringify(fields)}\n` +
      `Business profile: ${JSON.stringify(profile)}\n` +
      `Return the JSON now.`;
    const raw = await bedrockConverse(prompt, system);
    // Extract the first JSON object from the reply.
    const match = raw.match(/\{[\s\S]*\}/);
    try {
      const parsed = match ? JSON.parse(match[0]) : { values: {}, missing: fields };
      return {
        values: parsed.values ?? {},
        missing: Array.isArray(parsed.missing) ? parsed.missing : [],
      };
    } catch {
      return { values: {}, missing: fields };
    }
  },
});
