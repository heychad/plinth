import { httpAction, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

// ─── Web Crypto HMAC-SHA256 (V8-compatible, no Node crypto needed) ───────────

async function hmacSha256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
  // Zoom sends this to validate the endpoint URL during initial setup.
  // At this point Zoom doesn't include accountId, so we look up any stored
  // webhook secret from the DB.
  if (eventType === "endpoint.url_validation") {
    const plainToken = (payload.payload as Record<string, unknown>)
      ?.plainToken as string | undefined;
    if (!plainToken) {
      return new Response("Missing plainToken", { status: 400 });
    }

    // Get the webhook secret from DB (first available credential record)
    const secretToken = await ctx.runQuery(
      (internal as any).zoomCredentials.getChallengeSecret,
      {}
    );

    if (!secretToken) {
      return new Response("No Zoom credentials configured", { status: 500 });
    }

    const encryptedToken = await hmacSha256(secretToken, plainToken);

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

  // Look up the decrypted zoomCredentials for this accountId
  const zoomCred = await ctx.runQuery(
    (internal as any).zoomCredentials.getDecryptedCredByAccountId,
    { accountId: zoomAccountId }
  );

  if (!zoomCred) {
    // Unknown account — return 200 silently to avoid leaking info
    return new Response("OK", { status: 200 });
  }

  // Validate signature: v0:{timestamp}:{raw_body} → HMAC-SHA256 → v0={hex}
  const message = `v0:${timestamp}:${rawBody}`;
  const expectedHash = await hmacSha256(zoomCred.webhookSecretToken, message);
  const expectedSig = `v0=${expectedHash}`;

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
