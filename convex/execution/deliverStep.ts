"use node";

/**
 * Coaching Call Analyzer pipeline — Deliver step (Item 23, step 3).
 *
 * Updates the coachingCallReport document with final results and docUrl.
 * If the report is flagged, sends an email notification to adminEmail via Resend.
 * Email failures are non-fatal: errors are caught and logged; the step continues.
 *
 * Output: { notificationSent, notificationChannel }
 */

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

export const deliverStep = internalAction({
  args: {
    runId: v.id("agentRuns"),
    reportId: v.string(),
    docUrl: v.string(),
    flagged: v.boolean(),
    overallScore: v.number(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    notificationSent: boolean;
    notificationChannel: "email" | null;
  }> => {
    const reportId = args.reportId as import("../_generated/dataModel").Id<"coachingCallReports">;

    // Read the agent run to get agentConfigId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const run = (await ctx.runQuery((internal as any).agentRuns.getById, {
      runId: args.runId,
    })) as { agentConfigId: string } | null;

    if (!run) {
      throw new Error(`Agent run not found: ${args.runId}`);
    }

    const agentConfigId = run.agentConfigId as import("../_generated/dataModel").Id<"agentConfigs">;

    // Read agent config for adminEmail, adminName, programName etc.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const configRecord = (await ctx.runQuery(
      (internal as any).agentConfigs.getConfigById,
      { agentConfigId }
    )) as { config: Record<string, unknown> } | null;

    if (!configRecord) {
      throw new Error("Agent config not found");
    }

    const config = configRecord.config as {
      adminEmail?: string;
      adminName?: string;
      programName?: string;
      resendFromEmail?: string;
      notificationThreshold?: number;
    };

    // Read the report to get coachName, callNumber, scores for the email
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const report = (await ctx.runQuery(
      (internal as any).coachingCallReports.getReportById,
      { reportId }
    )) as {
      coachName?: string;
      studentName?: string;
      callNumber: number | "onboarding" | "bonus";
      overallScore: number;
      dimensionScores: Record<string, { score: number; notes: string; maxScore: number }>;
      highlights: string[];
      concerns: string[];
      narrative: string;
      coachTalkPercent?: number;
      flagged: boolean;
      rawAnalysisJson: unknown;
    } | null;

    if (!report) {
      throw new Error(`Report not found: ${args.reportId}`);
    }

    // Update the report: confirm final analysis fields are written and store docUrl.
    // The Analyze step already wrote overallScore/dimensions/etc., but the spec says
    // Deliver is responsible for the final report write. We patch to ensure consistency
    // and embed docUrl in rawAnalysisJson (schema has no dedicated docUrl field).
    const updatedRawJson =
      report.rawAnalysisJson != null &&
      typeof report.rawAnalysisJson === "object" &&
      !Array.isArray(report.rawAnalysisJson)
        ? { ...(report.rawAnalysisJson as Record<string, unknown>), docUrl: args.docUrl }
        : { docUrl: args.docUrl };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.runMutation((internal as any).coachingCallReports.updateReport, {
      reportId,
      overallScore: args.overallScore,
      flagged: args.flagged,
      status: "draft" as const,
      rawAnalysisJson: updatedRawJson,
    });

    // If not flagged, we are done — no notification
    if (!args.flagged) {
      return { notificationSent: false, notificationChannel: null };
    }

    // Flagged: send email to adminEmail
    const adminEmail = config.adminEmail;
    if (!adminEmail) {
      console.warn(
        `[deliverStep] Report ${args.reportId} is flagged but no adminEmail configured — skipping notification`
      );
      return { notificationSent: false, notificationChannel: null };
    }

    const coachName = report.coachName ?? "Coach";
    const callNumber = report.callNumber;
    const callNumberStr =
      typeof callNumber === "number" ? String(callNumber) : callNumber;
    const scoreStr = String(args.overallScore);
    const programName = config.programName ?? "Coaching Program";
    const adminName = config.adminName ?? "Admin";

    // Build concerns summary for email: take first two concerns
    const concerns = report.concerns ?? [];
    const concern1 = concerns[0] ?? "See full report for details";
    const concern2 = concerns[1];

    const emailVariables: Record<string, string> = {
      programName,
      coachName,
      callNumber: callNumberStr,
      score: scoreStr,
      adminName,
      concern1,
      reportUrl: args.docUrl,
    };
    if (concern2) {
      emailVariables.concern2 = concern2;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.runAction((internal as any).integrations.resend.sendNotificationEmail, {
        templateName: "flagged_call_admin",
        to: adminEmail,
        variables: emailVariables,
        fromEmail: config.resendFromEmail,
      });
      return { notificationSent: true, notificationChannel: "email" };
    } catch (err) {
      // Email failures are non-fatal — log and continue
      console.error(
        `[deliverStep] Failed to send flagged-call email for report ${args.reportId}:`,
        err instanceof Error ? err.message : String(err)
      );
      return { notificationSent: false, notificationChannel: null };
    }
  },
});
