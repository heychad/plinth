"use node";

import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { createDecipheriv, createCipheriv, randomBytes } from "crypto";
import { workflowManager } from "../execution/agentWorkflow";
import { simpleWorkflowManager } from "../execution/simpleWorkflow";

// ─── Encryption Helpers ───────────────────────────────────────────────────────
// Must match the format used by zoomCredentials.ts (builder-38):
// - IV (32 hex chars) prepended directly to ciphertext hex (no separator)
// - Key: first 32 bytes of ENCRYPTION_KEY as UTF-8

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

function encrypt(plaintext: string): string {
  const keyBuf = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", keyBuf, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + encrypted;
}

// ─── VTT Parsing Helpers ──────────────────────────────────────────────────────

/**
 * Converts a VTT timestamp string (HH:MM:SS.mmm) to milliseconds.
 */
export function parseTimestamp(ts: string): number {
  const parts = ts.split(":");
  if (parts.length !== 3) return 0;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const [secondsStr, msStr] = parts[2].split(".");
  const seconds = parseInt(secondsStr, 10);
  const ms = parseInt((msStr ?? "0").padEnd(3, "0").slice(0, 3), 10);
  return hours * 3_600_000 + minutes * 60_000 + seconds * 1_000 + ms;
}

interface VttCue {
  speaker: string;
  startMs: number;
  endMs: number;
  text: string;
}

interface ParsedVtt {
  plainText: string;
  cues: VttCue[];
}

/**
 * Parse a Zoom WebVTT transcript into plain text with speaker labels and
 * structured cues for talk-time computation.
 *
 * Rules:
 * - Discard WEBVTT header
 * - Discard timestamp lines (HH:MM:SS.mmm --> HH:MM:SS.mmm)
 * - Discard blank lines and cue index numbers (lines that are only digits)
 * - Preserve speaker-labeled lines: {SpeakerName}: {text}
 * - If no speaker label on a line, attribute to previous speaker
 */
export function parseVTT(vttText: string): ParsedVtt {
  const lines = vttText.split(/\r?\n/);
  const cues: VttCue[] = [];
  const textLines: string[] = [];

  const timestampRe = /^(\d{2}:\d{2}:\d{2}\.\d+)\s+-->\s+(\d{2}:\d{2}:\d{2}\.\d+)/;
  const speakerRe = /^([^:]+):\s+(.+)$/;

  let currentStartMs = 0;
  let currentEndMs = 0;
  let pendingTimestamp = false;
  let lastSpeaker = "";

  for (const raw of lines) {
    const line = raw.trim();

    // Skip blank lines
    if (line === "") {
      pendingTimestamp = false;
      continue;
    }

    // Skip WEBVTT header
    if (line === "WEBVTT") {
      continue;
    }

    // Skip cue index numbers (lines that are only digits)
    if (/^\d+$/.test(line)) {
      continue;
    }

    // Detect timestamp line
    const tsMatch = timestampRe.exec(line);
    if (tsMatch) {
      currentStartMs = parseTimestamp(tsMatch[1]);
      currentEndMs = parseTimestamp(tsMatch[2]);
      pendingTimestamp = true;
      continue;
    }

    // Text line — attributed to a speaker
    if (pendingTimestamp) {
      pendingTimestamp = false;
    }

    const speakerMatch = speakerRe.exec(line);
    let speaker: string;
    let text: string;

    if (speakerMatch) {
      speaker = speakerMatch[1].trim();
      text = speakerMatch[2].trim();
      lastSpeaker = speaker;
    } else {
      // No speaker label — attribute to previous speaker
      speaker = lastSpeaker;
      text = line;
    }

    cues.push({ speaker, startMs: currentStartMs, endMs: currentEndMs, text });
    textLines.push(speaker ? `${speaker}: ${text}` : text);
  }

  return {
    plainText: textLines.join("\n"),
    cues,
  };
}

/**
 * Computes the percentage of speaking time attributed to the coach.
 *
 * Per spec: without a zoomUserId → coach name mapping table, we cannot
 * reliably identify the coach speaker, so we return null.
 */
export function computeCoachTalkPercent(
  cues: Array<{ speaker: string; startMs: number; endMs: number }>,
  _zoomUserId: string
): number | null {
  // Accumulate total speaking time per speaker (for future use when mapping exists)
  const speakerMs: Record<string, number> = {};
  for (const cue of cues) {
    if (!cue.speaker) continue;
    const duration = cue.endMs - cue.startMs;
    speakerMs[cue.speaker] = (speakerMs[cue.speaker] ?? 0) + duration;
  }

  // Cannot match zoomUserId to coach name without a mapping table.
  // Return null per spec: "If coach speaker cannot be identified from Zoom
  // userId: set coachTalkPercent = null"
  void speakerMs;
  return null;
}

// ─── Internal Queries ────────────────────────────────────────────────────────

export const getProcessedEventByMeeting = internalQuery({
  args: {
    zoomMeetingId: v.string(),
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("zoomWebhookEvents")
      .withIndex("by_zoomMeetingId", (q) =>
        q.eq("zoomMeetingId", args.zoomMeetingId)
      )
      .collect();

    return (
      events.find(
        (e) => e.tenantId === args.tenantId && e.processed === true
      ) ?? null
    );
  },
});

export const getDeployedAnalyzerConfigs = internalQuery({
  args: {
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args) => {
    // Get all deployed agent configs for this tenant
    const configs = await ctx.db
      .query("agentConfigs")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
      .filter((q) => q.eq(q.field("status"), "deployed"))
      .collect();

    // Filter to coaching-call-analyzer template slug
    const results = [];
    for (const config of configs) {
      const template = await ctx.db.get(config.templateId);
      if (template && template.slug === "coaching-call-analyzer") {
        results.push({ config, template });
      }
    }
    return results;
  },
});

// ─── Internal Mutations ───────────────────────────────────────────────────────

export const markEventProcessed = internalMutation({
  args: {
    webhookEventId: v.id("zoomWebhookEvents"),
    agentRunId: v.optional(v.id("agentRuns")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.webhookEventId, {
      processed: true,
      processedAt: Date.now(),
      agentRunId: args.agentRunId,
    });
  },
});

export const markEventError = internalMutation({
  args: {
    webhookEventId: v.id("zoomWebhookEvents"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.webhookEventId, {
      error: args.error,
    });
  },
});

/**
 * Internal mutation: create an agentRun record and start the appropriate workflow.
 * This is the internal (no-auth) counterpart to the public triggerAgentRun mutation,
 * used when a webhook (not a user) triggers an agent run.
 */
export const createWebhookAgentRun = internalMutation({
  args: {
    agentConfigId: v.id("agentConfigs"),
    tenantId: v.id("tenants"),
    input: v.any(),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db.get(args.agentConfigId);
    if (!config) {
      throw new Error("Agent config not found");
    }
    if (config.status !== "deployed") {
      throw new Error("Agent config is not deployed");
    }

    const template = await ctx.db.get(config.templateId);
    if (!template) {
      throw new Error("Agent template not found");
    }

    const now = Date.now();
    const runId = await ctx.db.insert("agentRuns", {
      agentConfigId: args.agentConfigId,
      tenantId: args.tenantId,
      status: "queued",
      triggerType: "webhook",
      triggeredBy: undefined,
      input: args.input,
      workflowId: undefined,
      totalTokensIn: 0,
      totalTokensOut: 0,
      totalCostUsd: 0,
      queuedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Start the appropriate workflow and store its ID on the run record
    let workflowId: string;
    if (template.executionMode === "simple") {
      workflowId = await simpleWorkflowManager.start(
        ctx,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (internal as any).execution.simpleWorkflow.simpleWorkflow,
        { runId }
      );
    } else {
      workflowId = await workflowManager.start(
        ctx,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (internal as any).execution.agentWorkflow.agentWorkflow,
        { runId }
      );
    }

    await ctx.db.patch(runId, { workflowId });

    return runId;
  },
});

// ─── getOrRefreshZoomToken ────────────────────────────────────────────────────

/**
 * Retrieves a valid Zoom Server-to-Server OAuth access token for the tenant.
 * Returns a cached token if still valid (with 60s buffer); otherwise requests
 * a fresh token from Zoom using Server-to-Server OAuth.
 */
export const getOrRefreshZoomToken = internalAction({
  args: {
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args): Promise<string> => {
    // Use builder-38's query since it already owns zoomCredentials
    const cred = await ctx.runQuery(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (internal as any).zoomCredentials.getZoomCredentialsByTenantId,
      { tenantId: args.tenantId }
    );

    if (!cred) {
      throw new Error(`No Zoom credentials found for tenant ${args.tenantId}`);
    }

    const now = Date.now();

    // Return cached token if still valid (60s buffer)
    if (
      cred.accessToken &&
      cred.accessTokenExpiresAt &&
      cred.accessTokenExpiresAt > now + 60_000
    ) {
      return decrypt(cred.accessToken);
    }

    // Decrypt credentials for token request
    // clientId is not encrypted per schema; clientSecret is encrypted.
    const clientId = cred.clientId;
    const clientSecret = decrypt(cred.clientSecret);
    const accountId = cred.accountId;

    const b64Credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const tokenUrl = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`;

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${b64Credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Zoom token request failed (${response.status}): ${body}`
      );
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };
    const newToken = data.access_token;
    const expiresAt = now + (data.expires_in ?? 3600) * 1_000;

    // Encrypt and cache the new token using builder-38's updateZoomToken mutation
    const encryptedToken = encrypt(newToken);

    await ctx.runMutation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (internal as any).zoomCredentials.updateZoomToken,
      {
        tenantId: args.tenantId,
        accessToken: encryptedToken,
        accessTokenExpiresAt: expiresAt,
      }
    );

    return newToken;
  },
});

// ─── processZoomTranscript ────────────────────────────────────────────────────

/**
 * Downloads, parses, and processes a Zoom VTT transcript.
 * Triggers the coaching-call-analyzer pipeline for each deployed config.
 *
 * Called from the Zoom webhook handler after the 200 OK response is sent,
 * so Zoom is not blocked waiting for processing (SIGN-9: 3s hard limit).
 *
 * Args match what builder-17 (webhooks/zoom.ts) passes via ctx.scheduler.runAfter.
 */
export const processZoomTranscript = internalAction({
  args: {
    eventId: v.id("zoomWebhookEvents"),
    tenantId: v.id("tenants"),
    zoomMeetingId: v.string(),
    rawPayload: v.any(),
  },
  handler: async (ctx, args): Promise<void> => {
    const { eventId, tenantId, zoomMeetingId, rawPayload } = args;

    // 1. Dedup check (SIGN-8): if already processed for this tenantId + zoomMeetingId, skip
    const alreadyProcessed = await ctx.runQuery(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (internal as any).integrations.zoom.getProcessedEventByMeeting,
      { zoomMeetingId, tenantId }
    );

    if (alreadyProcessed) {
      console.log(
        `[zoom] Skipping duplicate: meeting ${zoomMeetingId} already processed for tenant ${tenantId}`
      );
      return;
    }

    // Extract fields from the raw Zoom webhook payload
    const payloadObj = rawPayload as Record<string, unknown>;
    const payloadInner = (payloadObj.payload as Record<string, unknown>) ?? {};
    const meetingObj = (payloadInner.object as Record<string, unknown>) ?? {};
    const recordingFiles = (meetingObj.recording_files as unknown[]) ?? [];
    const zoomUserId = String(meetingObj.host_id ?? "");

    // Find the TRANSCRIPT file entry to get download_url and download_access_token
    const transcriptFile = recordingFiles.find(
      (f) => (f as Record<string, unknown>).file_type === "TRANSCRIPT"
    ) as Record<string, unknown> | undefined;

    if (!transcriptFile) {
      // No transcript file — mark as processed (no-op) and exit
      await ctx.runMutation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (internal as any).integrations.zoom.markEventProcessed,
        { webhookEventId: eventId }
      );
      console.log(`[zoom] No TRANSCRIPT file for meeting ${zoomMeetingId} — skipping`);
      return;
    }

    const downloadUrl = String(transcriptFile.download_url ?? "");
    const downloadToken = String(transcriptFile.download_access_token ?? "");

    // 2. Get a valid Zoom access token
    let accessToken: string;
    try {
      accessToken = await ctx.runAction(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (internal as any).integrations.zoom.getOrRefreshZoomToken,
        { tenantId }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (internal as any).integrations.zoom.markEventError,
        { webhookEventId: eventId, error: `Token error: ${msg}` }
      );
      throw err;
    }

    // 3. Download VTT with retry (up to 3 attempts, 5s backoff)
    // downloadToken is preferred; fall back to access token if absent
    const authHeader = downloadToken
      ? `Bearer ${downloadToken}`
      : `Bearer ${accessToken}`;

    let vttContent: string | null = null;
    let lastDownloadError = "";

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(downloadUrl, {
          headers: { Authorization: authHeader },
          signal: AbortSignal.timeout(60_000),
        });

        if (!response.ok) {
          lastDownloadError = `HTTP ${response.status}: ${await response.text()}`;
          console.warn(
            `[zoom] VTT download attempt ${attempt} failed: ${lastDownloadError}`
          );
        } else {
          vttContent = await response.text();
          break;
        }
      } catch (err) {
        lastDownloadError =
          err instanceof Error ? err.message : String(err);
        console.warn(
          `[zoom] VTT download attempt ${attempt} error: ${lastDownloadError}`
        );
      }

      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 5_000));
      }
    }

    if (vttContent === null) {
      const errorMsg = `VTT download failed after 3 attempts: ${lastDownloadError}`;
      await ctx.runMutation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (internal as any).integrations.zoom.markEventError,
        { webhookEventId: eventId, error: errorMsg }
      );
      throw new Error(errorMsg);
    }

    // 4. Store raw VTT in Convex file storage
    const blob = new Blob([vttContent], { type: "text/vtt" });
    const storageId = await ctx.storage.store(blob);

    // 5. Parse VTT to plain text + speaker cues
    const { plainText, cues } = parseVTT(vttContent);
    const coachTalkPercent = computeCoachTalkPercent(cues, zoomUserId);

    // 6. Find deployed coaching-call-analyzer configs for this tenant
    const deployedEntries = await ctx.runQuery(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (internal as any).integrations.zoom.getDeployedAnalyzerConfigs,
      { tenantId }
    );

    // 7. Trigger a run for each matching config
    let lastRunId: string | undefined;

    for (const { config } of deployedEntries) {
      const runId = await ctx.runMutation(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (internal as any).integrations.zoom.createWebhookAgentRun,
        {
          agentConfigId: config._id,
          tenantId,
          input: {
            zoomMeetingId,
            transcriptStorageId: storageId,
            parsedTranscript: plainText,
            coachTalkPercent: coachTalkPercent ?? undefined,
            zoomUserId,
          },
        }
      );
      lastRunId = runId;
    }

    // 8. Mark the webhook event as processed
    await ctx.runMutation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (internal as any).integrations.zoom.markEventProcessed,
      {
        webhookEventId: eventId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        agentRunId: lastRunId as any,
      }
    );

    console.log(
      `[zoom] Processed meeting ${zoomMeetingId}: storageId=${storageId}, ` +
        `configs triggered=${deployedEntries.length}, coachTalkPercent=${coachTalkPercent}`
    );
  },
});
