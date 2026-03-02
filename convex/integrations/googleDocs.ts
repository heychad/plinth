import { v } from "convex/values";
import {
  internalAction,
  internalQuery,
  internalMutation,
} from "../_generated/server";
import { Composio } from "composio-core";
import { internal } from "../_generated/api";

// ─── Error classes ────────────────────────────────────────────────────────────

export class IntegrationNotConnectedError extends Error {
  constructor(slotName: string) {
    super(
      `Integration not connected: ${slotName}. Connect ${slotName} in the Integrations page.`
    );
    this.name = "IntegrationNotConnectedError";
  }
}

export class ComposioToolError extends Error {
  constructor(
    message: string,
    public readonly detail?: unknown
  ) {
    super(message);
    this.name = "ComposioToolError";
  }
}

// ─── Internal query: resolve credentials for a tenant + slotName ──────────────

export const getCredentialBySlot = internalQuery({
  args: {
    tenantId: v.id("tenants"),
    slotName: v.string(),
  },
  handler: async (ctx, { tenantId, slotName }) => {
    return await ctx.db
      .query("credentials")
      .withIndex("by_tenantId_slotName", (q) =>
        q.eq("tenantId", tenantId).eq("slotName", slotName)
      )
      .unique();
  },
});

// ─── Internal mutation: touch lastUsedAt on credential ───────────────────────

export const touchCredentialLastUsed = internalMutation({
  args: { credentialId: v.id("credentials") },
  handler: async (ctx, { credentialId }) => {
    await ctx.db.patch(credentialId, {
      lastUsedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// ─── Helper: format a coaching call report as a document string ───────────────

export type DimensionScore = {
  dimension: string;
  score: number;
  max: number;
  notes?: string;
};

export type CoachingReportArgs = {
  programName: string;
  platformName: string;
  coachName: string;
  studentName: string;
  callNumber: number | "onboarding" | "bonus";
  callTitle: string;
  flagged: boolean;
  overallScore: number;
  dimensionScores: DimensionScore[];
  highlights: string[];
  concerns: string[];
  narrative: string;
  coachTalkPercent?: number;
};

export function formatCoachingReport(args: CoachingReportArgs): string {
  const {
    programName,
    platformName,
    coachName,
    studentName,
    callNumber,
    callTitle,
    flagged,
    overallScore,
    dimensionScores,
    highlights,
    concerns,
    narrative,
    coachTalkPercent,
  } = args;

  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const callLabel =
    typeof callNumber === "number"
      ? `Call #${callNumber}`
      : `Call: ${callNumber}`;

  const statusLabel = flagged ? "FLAGGED" : "CLEAR";

  const divider = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

  // Build scorecard table
  const scorecardRows = dimensionScores
    .map(
      (d) =>
        `${d.dimension.padEnd(30)} | ${String(d.score).padStart(3)} | ${String(d.max).padStart(3)}`
    )
    .join("\n");

  const scorecard = [
    "Dimension                      | Score | Max",
    "-".repeat(44),
    scorecardRows,
    "-".repeat(44),
    `${"OVERALL SCORE:".padEnd(30)} | ${String(overallScore).padStart(3)} | 100`,
  ].join("\n");

  const highlightsList = highlights.map((h) => `• ${h}`).join("\n");
  const concernsList = concerns.map((c) => `• ${c}`).join("\n");

  const dimensionNotes = dimensionScores
    .filter((d) => d.notes)
    .map((d) => `${d.dimension}: ${d.notes}`)
    .join("\n");

  const talkTimeLine =
    coachTalkPercent !== undefined
      ? `Talk time: Coach ~${coachTalkPercent}% / Client ~${100 - coachTalkPercent}%`
      : "";

  const lines: string[] = [
    `${programName} — COACHING CALL REPORT`,
    `${platformName} | Generated ${date}`,
    "",
    `Coach: ${coachName}    Client: ${studentName}`,
    `${callLabel}: ${callTitle}    Status: ${statusLabel}`,
    "",
    divider,
    "SCORECARD",
    divider,
    scorecard,
    `OVERALL SCORE: ${overallScore} / 100`,
    "",
    divider,
    "HIGHLIGHTS",
    divider,
    highlightsList,
    "",
    divider,
    "CONCERNS",
    divider,
    concernsList,
    "",
    divider,
    "FEEDBACK DRAFT",
    "(Review and edit before sending to coach)",
    divider,
    narrative,
  ];

  if (dimensionNotes || talkTimeLine) {
    lines.push("", divider, "DIMENSION NOTES", divider);
    if (dimensionNotes) lines.push(dimensionNotes);
    if (talkTimeLine) lines.push(talkTimeLine);
  }

  return lines.join("\n");
}

// ─── Internal action: createGoogleDoc ────────────────────────────────────────

export const createGoogleDoc = internalAction({
  args: {
    tenantId: v.id("tenants"),
    title: v.string(),
    content: v.string(),
    folderId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { tenantId, title, content, folderId }
  ): Promise<{ docId: string; docUrl: string }> => {
    // 1. Resolve credentials for slotName "google_docs"
    const credential = await ctx.runQuery(
      internal.integrations.googleDocs.getCredentialBySlot,
      { tenantId, slotName: "google_docs" }
    );

    // 2. Validate credential status is "active"
    if (!credential || credential.status !== "active") {
      throw new IntegrationNotConnectedError("google_docs");
    }

    if (!credential.composioEntityId) {
      throw new IntegrationNotConnectedError("google_docs");
    }

    // 3. Initialize Composio client with the tenant's composioEntityId
    const composioApiKey = process.env.COMPOSIO_API_KEY;
    if (!composioApiKey) {
      throw new Error("COMPOSIO_API_KEY environment variable is not set");
    }

    const composio = new Composio({ apiKey: composioApiKey });
    const entity = composio.getEntity(credential.composioEntityId);

    // 4. Call Composio tool: GOOGLEDOCS_CREATE_DOCUMENT
    const createResult = await entity.execute({
      actionName: "GOOGLEDOCS_CREATE_DOCUMENT",
      params: {
        title,
        content,
      },
    });

    if (!createResult.successful) {
      throw new ComposioToolError(
        `GOOGLEDOCS_CREATE_DOCUMENT failed: ${createResult.error ?? "unknown error"}`,
        createResult
      );
    }

    const docData = createResult.data as Record<string, unknown>;
    const docId = (docData.documentId ?? docData.id ?? docData.doc_id) as string;
    const docUrl = (docData.documentLink ??
      docData.url ??
      docData.doc_url ??
      `https://docs.google.com/document/d/${docId}/edit`) as string;

    if (!docId) {
      throw new ComposioToolError(
        "GOOGLEDOCS_CREATE_DOCUMENT did not return a document ID",
        createResult
      );
    }

    // 5. If folderId provided: move doc to folder (best-effort)
    if (folderId) {
      await entity.execute({
        actionName: "GOOGLEDRIVE_MOVE_FILE",
        params: {
          file_id: docId,
          new_parent_id: folderId,
        },
      });
      // Move failures are non-fatal — doc is created; folder placement is nice-to-have
    }

    // 6. Update credential.lastUsedAt
    await ctx.runMutation(
      internal.integrations.googleDocs.touchCredentialLastUsed,
      { credentialId: credential._id }
    );

    // 7. Return docId and docUrl
    return { docId, docUrl };
  },
});
