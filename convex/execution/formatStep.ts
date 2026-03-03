"use node";

/**
 * Coaching Call Analyzer pipeline — Format step (Item 23, step 2).
 *
 * Takes the AnalysisResult stored on the coachingCallReport and formats it
 * into a human-readable report, then creates a Google Doc via the
 * google_docs integration slot.
 *
 * Output: { docUrl, reportFormatted }
 */

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import {
  formatCoachingReport,
  type DimensionScore,
} from "../integrations/googleDocs";

export const formatStep = internalAction({
  args: {
    runId: v.id("agentRuns"),
    reportId: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ docUrl: string; reportFormatted: string }> => {
    const reportId = args.reportId as import("../_generated/dataModel").Id<"coachingCallReports">;

    // Read the agent run to get agentConfigId and tenantId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const run = (await ctx.runQuery((internal as any).agentRuns.getById, {
      runId: args.runId,
    })) as {
      agentConfigId: string;
      tenantId: string;
    } | null;

    if (!run) {
      throw new Error(`Agent run not found: ${args.runId}`);
    }

    const tenantId = run.tenantId as import("../_generated/dataModel").Id<"tenants">;
    const agentConfigId = run.agentConfigId as import("../_generated/dataModel").Id<"agentConfigs">;

    // Read agent config
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const configRecord = (await ctx.runQuery(
      (internal as any).agentConfigs.getConfigById,
      { agentConfigId }
    )) as { config: Record<string, unknown> } | null;

    if (!configRecord) {
      throw new Error("Agent config not found");
    }

    const config = configRecord.config as {
      programName?: string;
      platformName?: string;
      rubricDimensions?: Array<{
        slug: string;
        displayName: string;
        maxScore: number;
      }>;
    };

    const programName = config.programName ?? "Coaching Program";
    // platformName may be set in config or fall back to a generic default
    const platformName = config.platformName ?? "Plinth";

    // Read the report for analysis results
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const report = (await ctx.runQuery(
      (internal as any).coachingCallReports.getReportById,
      { reportId }
    )) as {
      coachName?: string;
      studentName?: string;
      callNumber: number | "onboarding" | "bonus";
      overallScore: number;
      dimensionScores: Record<
        string,
        { score: number; notes: string; maxScore: number }
      >;
      highlights: string[];
      concerns: string[];
      narrative: string;
      editedNarrative?: string;
      coachTalkPercent?: number;
      flagged: boolean;
    } | null;

    if (!report) {
      throw new Error(`Report not found: ${args.reportId}`);
    }

    const coachName = report.coachName ?? "Coach";
    const studentName = report.studentName ?? "Client";
    const callNumber = report.callNumber;

    // Build DimensionScore array for the formatter
    const rubricDimensions = config.rubricDimensions ?? [];
    const dimensionScores: DimensionScore[] = rubricDimensions.map((dim) => {
      const result = report.dimensionScores[dim.slug];
      return {
        dimension: dim.displayName,
        score: result?.score ?? 0,
        max: result?.maxScore ?? dim.maxScore,
        notes: result?.notes ?? "",
      };
    });

    // If rubricDimensions not configured, fall back to dimensionScores keys
    if (dimensionScores.length === 0) {
      for (const [slug, result] of Object.entries(report.dimensionScores)) {
        dimensionScores.push({
          dimension: slug,
          score: result.score,
          max: result.maxScore,
          notes: result.notes,
        });
      }
    }

    // Derive a human-friendly call title from the call number
    const callTitle =
      typeof callNumber === "number"
        ? `Call ${callNumber}`
        : callNumber === "onboarding"
        ? "Onboarding Call"
        : "Bonus Call";

    // Build label used in the doc title: "#1", "onboarding", "bonus"
    const callLabel =
      typeof callNumber === "number" ? `#${callNumber}` : callNumber;

    // Use editedNarrative if admin has edited; otherwise fall back to raw AI narrative
    const narrativeToUse = report.editedNarrative ?? report.narrative;

    // Format the report text
    const reportFormatted = formatCoachingReport({
      programName,
      platformName,
      coachName,
      studentName,
      callNumber,
      callTitle,
      flagged: report.flagged,
      overallScore: report.overallScore,
      dimensionScores,
      highlights: report.highlights,
      concerns: report.concerns,
      narrative: narrativeToUse,
      coachTalkPercent: report.coachTalkPercent,
    });

    // Build the Google Doc title per spec:
    // "[ProgramName] — [CoachName] — Call #[X] — Feedback Report"
    const docTitle = `${programName} — ${coachName} — Call ${callLabel} — Feedback Report`;

    // Create the Google Doc via the integration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docResult = (await ctx.runAction(
      (internal as any).integrations.googleDocs.createGoogleDoc,
      {
        tenantId,
        title: docTitle,
        content: reportFormatted,
      }
    )) as { docId: string; docUrl: string };

    return { docUrl: docResult.docUrl, reportFormatted };
  },
});
