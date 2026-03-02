"use node";

import { httpAction, internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { createHmac, createDecipheriv } from "crypto";

// ─── Encryption helper (must match zoomCredentials.ts format) ────────────────
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY environment variable is not set");
  return Buffer.from(key, "utf8").subarray(0, 32);
}

function decrypt(encryptedHex: string): string {
  const keyBuf = getEncryptionKey();
  const iv = Buffer.from(encryptedHex.slice(0, 32), "hex");
  const decipher = createDecipheriv("aes-256-cbc", keyBuf, iv);
  let decrypted = decipher.update(encryptedHex.slice(32), "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * POST /webhooks/zoom
 *
 * Handles incoming Zoom webhook events:
 * - Validates HMAC-SHA256 signature from Zoom
 * - Responds to endpoint.url_validation challenge
 * - Routes recording.transcript_completed events to async processing
 * - Returns 200 immediately — all processing deferred (SIGN-9: 3s hard limit)
 */
export const zoomWebhook = httpAction(async (ctx, request) => {
  // ── Read raw body first (needed for signature validation) ─────────────────
  const rawBody = await request.text();

  const signature = request.headers.get("x-zm-signature") ?? "";
  const timestamp = request.headers.get("x-zm-request-timestamp") ?? "";

  // ── Parse body ────────────────────────────────────────────────────────────
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const eventType = payload.event as string | undefined;

  // ── Challenge-response (no signature required for this event) ────────────
  // Zoom sends this to validate the endpoint URL
  if (eventType === "endpoint.url_validation") {
    const plainToken = (payload.payload as Record<string, unknown>)
      ?.plainToken as string | undefined;
    if (!plainToken) {
      return new Response("Missing plainToken", { status: 400 });
    }

    // For challenge-response we need the webhook secret token.
    // Zoom doesn't tell us which account this is for during validation,
    // so we use the environment variable ZOOM_WEBHOOK_SECRET_TOKEN if set,
    // or look for any active zoomCredentials record.
    // Per Zoom docs: the secret used is the one configured in the app.
    const secretToken = process.env.ZOOM_WEBHOOK_SECRET_TOKEN ?? "";
    const encryptedToken = createHmac("sha256", secretToken)
      .update(plainToken)
      .digest("hex");

    return new Response(
      JSON.stringify({ plainToken, encryptedToken }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // ── Signature validation (required for all other events) ─────────────────
  // Zoom accountId in payload lets us look up the right webhookSecretToken
  const zoomAccountId = (payload.payload as Record<string, unknown>)
    ?.accountId as string | undefined;

  if (!zoomAccountId) {
    return new Response("Missing accountId in payload", { status: 400 });
  }

  // Look up the zoomCredentials record for this accountId to get the secret
  const zoomCred = await ctx.runQuery(
    (internal as any).webhooks.zoom.getZoomCredByAccountId,
    { accountId: zoomAccountId }
  );

  if (!zoomCred) {
    // Unknown account — return 200 silently to avoid leaking info
    return new Response("OK", { status: 200 });
  }

  // Validate signature: v0:{timestamp}:{raw_body} → HMAC-SHA256 → v0={hex}
  // webhookSecretToken is stored encrypted — decrypt before HMAC
  const secretToken = decrypt(zoomCred.webhookSecretToken);
  const message = `v0:${timestamp}:${rawBody}`;
  const expectedSig = "v0=" + createHmac("sha256", secretToken)
    .update(message)
    .digest("hex");

  if (signature !== expectedSig) {
    return new Response("Signature mismatch", { status: 400 });
  }

  // ── Event routing ─────────────────────────────────────────────────────────

  if (eventType === "recording.transcript_completed") {
    const meetingPayload = (payload.payload as Record<string, unknown>)
      ?.object as Record<string, unknown> | undefined;

    if (!meetingPayload) {
      return new Response("Missing payload.object", { status: 400 });
    }

    const zoomMeetingId = String(meetingPayload.id ?? "");
    const hostId = String(meetingPayload.host_id ?? "");
    const recordingFiles = (meetingPayload.recording_files as unknown[]) ?? [];

    // Check for TRANSCRIPT type file
    const hasTranscript = recordingFiles.some(
      (f) => (f as Record<string, unknown>).file_type === "TRANSCRIPT"
    );

    if (!hasTranscript) {
      // No transcript file — log as no-op and return 200
      await ctx.runMutation(
        (internal as any).webhooks.zoom.logZoomWebhookEvent,
        {
          tenantId: zoomCred.tenantId,
          zoomMeetingId: zoomMeetingId || "unknown",
          eventType: eventType,
          zoomUserId: hostId,
          rawPayload: payload,
          processed: true, // mark as processed (no-op)
        }
      );
      return new Response("OK", { status: 200 });
    }

    // Log the event (processed: false — will be processed async)
    const eventId = await ctx.runMutation(
      (internal as any).webhooks.zoom.logZoomWebhookEvent,
      {
        tenantId: zoomCred.tenantId,
        zoomMeetingId: zoomMeetingId || "unknown",
        eventType: eventType,
        zoomUserId: hostId,
        rawPayload: payload,
        processed: false,
      }
    );

    // Schedule async processing — deferred to avoid 3s timeout (SIGN-9)
    await ctx.scheduler.runAfter(
      0,
      (internal as any).integrations.zoom.processZoomTranscript,
      {
        eventId,
        tenantId: zoomCred.tenantId,
        zoomMeetingId,
        rawPayload: payload,
      }
    );

    return new Response("OK", { status: 200 });
  }

  // ── All other events: acknowledge silently ────────────────────────────────
  return new Response("OK", { status: 200 });
});

/**
 * Internal query: look up a zoomCredentials record by Zoom accountId.
 * Used by the webhook handler to resolve tenantId and get webhookSecretToken.
 */
export const getZoomCredByAccountId = internalQuery({
  args: { accountId: v.string() },
  handler: async (ctx, { accountId }) => {
    // No index on accountId — scan all records and filter
    // (zoomCredentials is expected to be a small table per deployment)
    const all = await ctx.db.query("zoomCredentials").collect();
    return all.find((c) => c.accountId === accountId) ?? null;
  },
});

/**
 * Internal mutation: log a Zoom webhook event to the zoomWebhookEvents table.
 * Returns the ID of the inserted event document.
 */
export const logZoomWebhookEvent = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    zoomMeetingId: v.string(),
    eventType: v.string(),
    zoomUserId: v.string(),
    rawPayload: v.any(),
    processed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("zoomWebhookEvents", {
      tenantId: args.tenantId,
      zoomMeetingId: args.zoomMeetingId,
      eventType: args.eventType,
      zoomUserId: args.zoomUserId,
      rawPayload: args.rawPayload,
      processed: args.processed,
      createdAt: Date.now(),
    });
    return id;
  },
});
