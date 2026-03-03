/**
 * Coaching Call Analyzer pipeline steps: Intake (Item 21) and Analyze (Item 22).
 *
 * These are Convex internalActions. They are called by the pipeline execution
 * engine after the standard agentWorkflow routes a run to the coaching pipeline.
 *
 * Intake step:
 *   - Webhook path: reads pre-downloaded transcript from Convex storage
 *   - Manual path: stores provided transcript text to Convex storage, parses VTT
 *   - Checks word count; creates initial coachingCallReport
 *
 * Analyze step:
 *   - Looks up curriculum entry for the call number
 *   - Builds prompt with transcript + curriculum + rubric dimensions
 *   - Calls Claude (claude-sonnet-4-6) with tool_use structured output
 *   - Validates and caps dimension scores
 *   - Updates the report with analysis results
 */

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const AnalysisResultSchema = z.object({
  callNumber: z.union([z.number(), z.literal("onboarding"), z.literal("bonus")]),
  overallScore: z.number().min(0).max(100),
  dimensions: z.record(
    z.string(),
    z.object({
      score: z.number(),
      notes: z.string(),
      additionalData: z.record(z.string(), z.unknown()).optional(),
    })
  ),
  highlights: z.array(z.string()).min(1).max(5),
  concerns: z.array(z.string()).min(0).max(6),
  narrative: z.string(),
  coachTalkPercent: z.number().min(0).max(100).nullable(),
});

type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

// ─── VTT Parsing Utilities ────────────────────────────────────────────────────

/**
 * Parse a VTT transcript: strip timestamp lines, preserve speaker labels,
 * return clean text suitable for analysis.
 */
function parseVtt(vttText: string): string {
  const lines = vttText.split("\n");
  const outputLines: string[] = [];
  let currentSpeaker = "";

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip WebVTT header and NOTE blocks
    if (
      trimmed === "WEBVTT" ||
      trimmed.startsWith("NOTE") ||
      trimmed === ""
    ) {
      continue;
    }

    // Skip timestamp lines (e.g., "00:00:01.000 --> 00:00:04.000")
    if (/^\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/.test(trimmed)) {
      continue;
    }

    // Skip cue identifier lines (pure numbers)
    if (/^\d+$/.test(trimmed)) {
      continue;
    }

    // Detect speaker label pattern "Speaker Name: text" or "<v Speaker>text"
    const speakerVTag = trimmed.match(/^<v ([^>]+)>(.*)/);
    if (speakerVTag) {
      const speaker = speakerVTag[1].trim();
      const text = speakerVTag[2].replace(/<[^>]*>/g, "").trim();
      if (speaker !== currentSpeaker) {
        currentSpeaker = speaker;
        outputLines.push(`${speaker}: ${text}`);
      } else {
        outputLines.push(text);
      }
      continue;
    }

    // Detect "Speaker: text" inline format (common in Zoom VTT)
    const inlineSpeaker = trimmed.match(/^([A-Z][^:]{0,40}):\s+(.+)/);
    if (inlineSpeaker) {
      const speaker = inlineSpeaker[1].trim();
      const text = inlineSpeaker[2].trim();
      if (speaker !== currentSpeaker) {
        currentSpeaker = speaker;
        outputLines.push(`${speaker}: ${text}`);
      } else {
        outputLines.push(text);
      }
      continue;
    }

    // Plain text line — strip any remaining tags
    const plain = trimmed.replace(/<[^>]*>/g, "").trim();
    if (plain) {
      outputLines.push(plain);
    }
  }

  return outputLines.join("\n");
}

/**
 * Compute coach talk percentage from VTT timestamps + speaker labels.
 * Returns null if the coach speaker cannot be identified.
 *
 * Heuristic: the speaker with the most cumulative speaking time who is
 * NOT the client/student is the coach. We use the first non-client speaker
 * as "coach" when there are exactly two speakers; otherwise return null.
 */
function computeCoachTalkPercent(
  vttText: string,
  coachName?: string
): number | null {
  // Map from speaker name to total seconds spoken
  const speakerTimes: Map<string, number> = new Map();

  const lines = vttText.split("\n");
  let currentTimestamp: { start: number; end: number } | null = null;
  let currentSpeakers: string[] = [];

  const parseSeconds = (ts: string): number => {
    // Format: HH:MM:SS.mmm or MM:SS.mmm
    const parts = ts.replace(",", ".").split(":");
    if (parts.length === 3) {
      return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    }
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Timestamp line
    const tsMatch = trimmed.match(
      /^(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})/
    );
    if (tsMatch) {
      currentTimestamp = {
        start: parseSeconds(tsMatch[1]),
        end: parseSeconds(tsMatch[2]),
      };
      currentSpeakers = [];
      continue;
    }

    if (!currentTimestamp) continue;

    // <v Speaker> tag
    const vTag = trimmed.match(/^<v ([^>]+)>/);
    if (vTag) {
      currentSpeakers = [vTag[1].trim()];
      const duration = currentTimestamp.end - currentTimestamp.start;
      const spk = currentSpeakers[0];
      speakerTimes.set(spk, (speakerTimes.get(spk) ?? 0) + duration);
      continue;
    }

    // Inline "Speaker: text" format — attribute to identified speaker
    const inlineMatch = trimmed.match(/^([A-Z][^:]{0,40}):\s+.+/);
    if (inlineMatch && currentSpeakers.length === 0) {
      const speaker = inlineMatch[1].trim();
      currentSpeakers = [speaker];
      const duration = currentTimestamp.end - currentTimestamp.start;
      speakerTimes.set(speaker, (speakerTimes.get(speaker) ?? 0) + duration);
    }
  }

  if (speakerTimes.size === 0) return null;

  const totalTime = Array.from(speakerTimes.values()).reduce((a, b) => a + b, 0);
  if (totalTime === 0) return null;

  // If coachName is provided, look for a matching speaker
  if (coachName) {
    const normalizedCoach = coachName.toLowerCase();
    for (const [speaker, time] of speakerTimes) {
      if (speaker.toLowerCase().includes(normalizedCoach)) {
        return Math.round((time / totalTime) * 100);
      }
    }
  }

  // With exactly 2 speakers, the one who speaks more is typically the coach
  if (speakerTimes.size === 2) {
    const sorted = Array.from(speakerTimes.entries()).sort((a, b) => b[1] - a[1]);
    const coachTime = sorted[0][1];
    return Math.round((coachTime / totalTime) * 100);
  }

  // Cannot determine coach speaker
  return null;
}

/**
 * Count words in a text string.
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ─── Intake Step ──────────────────────────────────────────────────────────────

export const intakeStep = internalAction({
  args: {
    runId: v.id("agentRuns"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    reportId: string;
    transcriptStorageId: string;
    parsedTranscript: string;
    callNumber: number | "onboarding" | "bonus" | null;
    coachTalkPercent: number | null;
    coachName?: string;
    studentName?: string;
    skipped: boolean;
  }> => {
    // Read the agent run
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const run = await ctx.runQuery((internal as any).agentRuns.getById, {
      runId: args.runId,
    }) as {
      agentConfigId: string;
      tenantId: string;
      input: Record<string, unknown>;
    } | null;

    if (!run) {
      throw new Error(`Agent run not found: ${args.runId}`);
    }

    const input = run.input as Record<string, unknown>;
    const tenantId = run.tenantId as import("../_generated/dataModel").Id<"tenants">;
    const agentConfigId = run.agentConfigId as import("../_generated/dataModel").Id<"agentConfigs">;

    // Read agent config for merged config
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const configRecord = await ctx.runQuery((internal as any).agentConfigs.getConfigById, {
      agentConfigId,
    }) as { config: Record<string, unknown> } | null;

    const mergedConfig = (configRecord?.config as Record<string, unknown>) ?? {};

    // Extract identity fields from run input
    const coachId = (input.coachId as string) ?? "unknown";
    const coachName = input.coachName as string | undefined;
    const studentName = input.studentName as string | undefined;
    const zoomMeetingId = input.zoomMeetingId as string | undefined;
    const callNumberInput = input.callNumber as number | "onboarding" | "bonus" | undefined;

    let transcriptStorageId: string;
    let parsedTranscript: string;
    let coachTalkPercent: number | null;

    // ── Webhook path ─────────────────────────────────────────────────────────
    if (input.transcriptStorageId) {
      transcriptStorageId = input.transcriptStorageId as string;
      parsedTranscript = (input.parsedTranscript as string) ?? "";
      coachTalkPercent =
        typeof input.coachTalkPercent === "number" ? input.coachTalkPercent : null;

      // If parsedTranscript is not pre-provided, read and parse VTT from storage
      if (!parsedTranscript) {
        const url = await ctx.storage.getUrl(
          transcriptStorageId as import("../_generated/dataModel").Id<"_storage">
        );
        if (!url) {
          throw new Error(`Transcript not found in storage: ${transcriptStorageId}`);
        }
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch transcript: ${response.status}`);
        }
        const rawVtt = await response.text();
        parsedTranscript = parseVtt(rawVtt);

        if (coachTalkPercent === null) {
          coachTalkPercent = computeCoachTalkPercent(rawVtt, coachName);
        }
      }
    }
    // ── Manual path ──────────────────────────────────────────────────────────
    else if (input.transcriptText) {
      const rawVtt = input.transcriptText as string;

      // Parse VTT to plain text
      parsedTranscript = parseVtt(rawVtt);

      // Compute coach talk percent from VTT timestamps
      coachTalkPercent = computeCoachTalkPercent(rawVtt, coachName);

      // Store raw VTT text to Convex file storage
      const blob = new Blob([rawVtt], { type: "text/vtt" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const storageIdResult = await ctx.storage.store(blob as any);
      transcriptStorageId = storageIdResult as unknown as string;
    } else {
      throw new Error(
        "Agent run input must include either transcriptStorageId or transcriptText"
      );
    }

    // ── Word count gate ───────────────────────────────────────────────────────
    const wordCount = countWords(parsedTranscript);
    if (wordCount < 500) {
      // Create a no_action report and exit pipeline
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reportId = await ctx.runMutation((internal as any).coachingCallReports.createInitialReport, {
        tenantId,
        agentRunId: args.runId,
        coachId,
        coachName,
        studentName,
        callNumber: callNumberInput ?? "bonus",
        zoomMeetingId,
        transcriptStorageId,
        parsedTranscript,
        coachTalkPercent: coachTalkPercent ?? undefined,
      }) as string;

      // Mark as no_action with a note
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.runMutation((internal as any).coachingCallReports.updateReport, {
        reportId,
        status: "no_action" as const,
        narrative: "Transcript too short for coaching analysis",
      });

      return {
        reportId,
        transcriptStorageId,
        parsedTranscript,
        callNumber: callNumberInput ?? null,
        coachTalkPercent,
        coachName,
        studentName,
        skipped: true,
      };
    }

    // ── Create initial report ─────────────────────────────────────────────────
    const callNumber: number | "onboarding" | "bonus" = callNumberInput ?? 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reportId = await ctx.runMutation((internal as any).coachingCallReports.createInitialReport, {
      tenantId,
      agentRunId: args.runId,
      coachId,
      coachName,
      studentName,
      callNumber,
      zoomMeetingId,
      transcriptStorageId,
      parsedTranscript,
      coachTalkPercent: coachTalkPercent ?? undefined,
    }) as string;

    // Suppress unused variable warning — mergedConfig used by caller context
    void mergedConfig;

    return {
      reportId,
      transcriptStorageId,
      parsedTranscript,
      callNumber: callNumberInput ?? null,
      coachTalkPercent,
      coachName,
      studentName,
      skipped: false,
    };
  },
});

// ─── Analyze Step ─────────────────────────────────────────────────────────────

export const analyzeStep = internalAction({
  args: {
    runId: v.id("agentRuns"),
    reportId: v.string(),
  },
  handler: async (ctx, args): Promise<{ overallScore: number; flagged: boolean }> => {
    // Read the agent run to get agentConfigId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const run = await ctx.runQuery((internal as any).agentRuns.getById, {
      runId: args.runId,
    }) as { agentConfigId: string } | null;

    if (!run) {
      throw new Error(`Agent run not found: ${args.runId}`);
    }

    const agentConfigId = run.agentConfigId as import("../_generated/dataModel").Id<"agentConfigs">;

    // Read agent config
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const configRecord = await ctx.runQuery((internal as any).agentConfigs.getConfigById, {
      agentConfigId,
    }) as { config: Record<string, unknown> } | null;

    if (!configRecord) {
      throw new Error("Agent config not found");
    }

    const config = configRecord.config as {
      curriculum?: Array<{
        callNumber: number | "onboarding" | "bonus";
        title: string;
        mustCoverTopics: string[];
        expectedHomeworkReviewed: string;
        actionItemsToAssign: string[];
      }>;
      rubricDimensions?: Array<{
        slug: string;
        displayName: string;
        maxScore: number;
        description: string;
        anchors: Array<{ score: number; description: string }>;
      }>;
      notificationThreshold?: number;
    };

    // Read the report to get callNumber and parsedTranscript
    const reportId = args.reportId as import("../_generated/dataModel").Id<"coachingCallReports">;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const report = await ctx.runQuery((internal as any).coachingCallReports.getReportById, {
      reportId,
    }) as {
      callNumber: number | "onboarding" | "bonus";
      parsedTranscript?: string;
      transcriptStorageId: string;
    } | null;

    if (!report) {
      throw new Error(`Report not found: ${args.reportId}`);
    }

    const callNumber = report.callNumber;

    // Resolve parsedTranscript — read from storage if not on the report doc
    let transcriptText = report.parsedTranscript ?? "";
    if (!transcriptText && report.transcriptStorageId) {
      const url = await ctx.storage.getUrl(
        report.transcriptStorageId as import("../_generated/dataModel").Id<"_storage">
      );
      if (!url) {
        throw new Error("Transcript not found in storage");
      }
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`Failed to fetch transcript: ${resp.status}`);
      }
      transcriptText = await resp.text();
    }

    const curriculum = config.curriculum ?? [];
    const rubricDimensions = config.rubricDimensions ?? [];
    const notificationThreshold = config.notificationThreshold ?? 70;

    // Look up curriculum entry for this call number
    const curriculumEntry = curriculum.find((c) => c.callNumber === callNumber);
    const genericAnchor =
      "Topic-specific; assess appropriateness for the stated objective and client needs.";

    // Build analysis prompt
    const curriculumSection = curriculumEntry
      ? `## Curriculum for Call ${callNumber}: ${curriculumEntry.title}

Must-cover topics:
${curriculumEntry.mustCoverTopics.map((t) => `- ${t}`).join("\n")}

Expected homework reviewed: ${curriculumEntry.expectedHomeworkReviewed}

Action items to assign:
${curriculumEntry.actionItemsToAssign.map((t) => `- ${t}`).join("\n")}`
      : `## Curriculum
No specific curriculum entry found for call number "${callNumber}".
${genericAnchor}`;

    const rubricSection = rubricDimensions
      .map(
        (dim) => `### ${dim.displayName} (max ${dim.maxScore} points)
${dim.description}

Score anchors:
${dim.anchors.map((a) => `- ${a.score} pts: ${a.description}`).join("\n")}`
      )
      .join("\n\n");

    const analysisPrompt = `You are a coaching quality analyst. Analyze the following coaching call transcript.

${curriculumSection}

## Scoring Rubric

${rubricSection}

## Transcript

${transcriptText}

---

Analyze the transcript and provide your assessment. Score each dimension based on the anchors provided.
Be specific and cite evidence from the transcript. The narrative should be 3 paragraphs written for the coach.

Return your analysis using the submit_analysis tool.`;

    // Build the JSON schema from the Zod schema using zod v4's toJSONSchema
    const analysisJsonSchema = z.toJSONSchema(AnalysisResultSchema);

    // Call Claude with tool_use structured output
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: analysisPrompt }],
      tools: [
        {
          name: "submit_analysis",
          description: "Submit the coaching call analysis results",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          input_schema: analysisJsonSchema as any,
        },
      ],
      tool_choice: { type: "tool", name: "submit_analysis" },
    });

    // Extract tool_use content block
    const toolUseBlock = response.content.find((block) => block.type === "tool_use");
    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      throw new Error("Claude did not return a tool_use block");
    }

    // Parse and validate with Zod
    let analysisResult: AnalysisResult;
    try {
      analysisResult = AnalysisResultSchema.parse(toolUseBlock.input);
    } catch (err) {
      // eslint-disable-next-line preserve-caught-error -- Convex ES target does not support Error cause
      throw new Error(
        `Claude returned invalid analysis: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Validate and cap dimension scores
    const cappedDimensions: Record<
      string,
      { score: number; notes: string; additionalData?: Record<string, unknown>; maxScore: number }
    > = {};

    let computedOverallScore = 0;

    for (const dim of rubricDimensions) {
      const dimResult = analysisResult.dimensions[dim.slug];
      if (!dimResult) {
        // Missing dimension — assign 0
        cappedDimensions[dim.slug] = {
          score: 0,
          notes: "Dimension not scored by analysis",
          maxScore: dim.maxScore,
        };
        continue;
      }

      let score = dimResult.score;
      if (score > dim.maxScore) {
        console.warn(
          `Dimension ${dim.slug} score ${score} exceeds maxScore ${dim.maxScore}; capping.`
        );
        score = dim.maxScore;
      }
      if (score < 0) score = 0;

      cappedDimensions[dim.slug] = {
        score,
        notes: dimResult.notes,
        additionalData: dimResult.additionalData,
        maxScore: dim.maxScore,
      };
      computedOverallScore += score;
    }

    const flagged = computedOverallScore < notificationThreshold;

    // Update the report with analysis results
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.runMutation((internal as any).coachingCallReports.updateReport, {
      reportId,
      overallScore: computedOverallScore,
      dimensionScores: cappedDimensions,
      highlights: analysisResult.highlights,
      concerns: analysisResult.concerns,
      narrative: analysisResult.narrative,
      coachTalkPercent: analysisResult.coachTalkPercent ?? undefined,
      flagged,
      rawAnalysisJson: toolUseBlock.input,
    });

    return { overallScore: computedOverallScore, flagged };
  },
});
