/**
 * Seed script: coaching-call-analyzer agent template
 *
 * Creates the agentTemplate for the Growth Factor Implementation coaching
 * call analyzer. Idempotent — skips creation if the slug already exists.
 *
 * Usage (from Convex dashboard or CLI):
 *   npx convex run seeds/coachingCallAnalyzerTemplate:seedCoachingCallAnalyzer \
 *     '{"createdByUserId": "<user_id>"}'
 */

import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const seedCoachingCallAnalyzer = internalMutation({
  args: {
    createdByUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Idempotency check
    const existing = await ctx.db
      .query("agentTemplates")
      .withIndex("by_slug", (q) => q.eq("slug", "coaching-call-analyzer"))
      .unique();

    if (existing) {
      return { created: false, templateId: existing._id };
    }

    const now = Date.now();

    const templateId = await ctx.db.insert("agentTemplates", {
      slug: "coaching-call-analyzer",
      displayName: "Coaching Call Analyzer",
      description:
        "Analyzes coaching call transcripts against a configurable curriculum and rubric. " +
        "Produces a structured scorecard with highlights, concerns, and a narrative feedback draft. " +
        "Flags calls below a configurable quality threshold for admin review.",
      category: "coaching",
      version: 1,
      isActive: true,
      isPipeline: true,
      executionMode: "autonomous",
      estimatedDurationSeconds: 120,
      systemPrompt:
        "You are a coaching quality analyst. Your job is to evaluate coaching calls against " +
        "a structured curriculum and rubric. You are objective, evidence-based, and constructive. " +
        "You cite specific moments from the transcript to support your scores. " +
        "You never fabricate evidence. If a topic was not covered, you say so plainly. " +
        "Your narrative feedback is written for the coach — it is direct, kind, and actionable.",

      integrationSlots: ["google_docs"],

      inputSchema: {
        transcriptStorageId: {
          type: "string",
          description: "Convex file storage ID for a previously stored VTT transcript (webhook path)",
          required: false,
        },
        transcriptText: {
          type: "string",
          description: "Raw VTT transcript text (manual upload path)",
          required: false,
        },
        callNumber: {
          type: "union",
          description: "Call number in the program sequence (number, 'onboarding', or 'bonus')",
          required: false,
        },
        coachId: {
          type: "string",
          description: "External coach identifier",
          required: true,
        },
        coachName: {
          type: "string",
          description: "Display name of the coach",
          required: false,
        },
        studentName: {
          type: "string",
          description: "Display name of the student/client",
          required: false,
        },
        zoomMeetingId: {
          type: "string",
          description: "Zoom meeting ID (if sourced from Zoom webhook)",
          required: false,
        },
        coachTalkPercent: {
          type: "number",
          description: "Percent of speaking time by coach (pre-computed from VTT on webhook path)",
          required: false,
        },
        parsedTranscript: {
          type: "string",
          description: "Plain text transcript (pre-parsed on webhook path)",
          required: false,
        },
      },

      defaultLockedFields: ["rubricDimensions", "curriculum", "programName"],
      defaultCustomizableFields: ["notificationThreshold", "adminEmail", "adminName"],

      defaultConfig: {
        programName: "Growth Factor Implementation",
        adminName: "Daniela",
        notificationThreshold: 70,
        rubricDimensions: [
          {
            slug: "curriculum_adherence",
            displayName: "Curriculum Adherence",
            maxScore: 25,
            description: "Did the coach cover the required topics for this specific call number?",
            anchors: [
              { score: 25, description: "All required topics covered with depth" },
              { score: 20, description: "Most topics covered; one minor omission" },
              { score: 15, description: "Core topic covered but supporting elements missed" },
              { score: 10, description: "Topic partially addressed; significant gaps" },
              { score: 5, description: "Wrong topics covered / significant deviation" },
              { score: 0, description: "Completely off-curriculum" },
            ],
          },
          {
            slug: "homework_follow_through",
            displayName: "Homework & Action Item Follow-Through",
            maxScore: 25,
            description: "Did the coach review prior homework and assign clear next steps?",
            anchors: [
              { score: 25, description: "Prior action items fully reviewed + new items assigned with deadlines" },
              { score: 20, description: "Homework reviewed briefly; action items assigned without full accountability" },
              { score: 15, description: "One of the two (review OR assignment) done well" },
              { score: 10, description: "Cursory mention only" },
              { score: 0, description: "Neither reviewed nor assigned" },
            ],
          },
          {
            slug: "coaching_technique",
            displayName: "Coaching Technique",
            maxScore: 25,
            description: "Active listening, asking vs. telling, holding space, not over-advising.",
            anchors: [
              { score: 25, description: "Primarily question-based; client does most of the talking; empathetic; stays in coach role" },
              { score: 20, description: "Mostly coaching; occasional advice-giving or over-talking" },
              { score: 15, description: "Mixed; coach frequently shifted into consultant/advisor mode" },
              { score: 10, description: "Predominantly advice-giving; client was passive" },
              { score: 0, description: "Lecture/training mode; no coaching dynamic" },
            ],
          },
          {
            slug: "client_progress_tracking",
            displayName: "Client Progress Tracking",
            maxScore: 25,
            description: "Is the coach actively monitoring where the client is in the milestone system?",
            anchors: [
              { score: 25, description: "Milestone tracker explicitly referenced; stuck points identified; progress celebrated" },
              { score: 20, description: "Progress discussed but not tied to milestone system" },
              { score: 15, description: "Progress mentioned in passing; no structured review" },
              { score: 0, description: "No reference to progress, milestones, or where client is in the journey" },
            ],
          },
        ],
        curriculum: [
          {
            callNumber: "onboarding",
            title: "1:1 with Daniela",
            mustCoverTopics: ["Program overview", "milestone tracker intro", "top 3 priorities", "90-day goals"],
            expectedHomeworkReviewed: "n/a",
            actionItemsToAssign: ["First call prep", "ICA worksheet"],
          },
          {
            callNumber: 1,
            title: "Ideal Client Avatar",
            mustCoverTopics: ["ICA profile", "psychographics", "pain points", "desires", "business alignment to avatar"],
            expectedHomeworkReviewed: "ICA pre-work video",
            actionItemsToAssign: ["ICA worksheet", "market research", "competitor analysis"],
          },
          {
            callNumber: 2,
            title: "Pricing + Profitability",
            mustCoverTopics: ["COT analysis", "profitability tracker", "POS reports", "loss leaders", "profit-based pricing"],
            expectedHomeworkReviewed: "COT + Profitability Tracker video",
            actionItemsToAssign: ["COT for all services", "POS data pull", "pricing adjustments"],
          },
          {
            callNumber: 3,
            title: "Cash Flow Mastery",
            mustCoverTopics: ["YNAB setup", "business account structure", "cash flow patterns", "% allocations", "90-day forecast"],
            expectedHomeworkReviewed: "YNAB pre-work",
            actionItemsToAssign: ["YNAB setup + bank connection", "fund accounts", "first month allocation"],
          },
          {
            callNumber: 4,
            title: "Offers Architecture",
            mustCoverTopics: ["Critical Number", "membership structure", "packages audit", "profit margins", "offer pricing matrix"],
            expectedHomeworkReviewed: "Previous action items",
            actionItemsToAssign: ["Membership design/revision", "package creation", "menu updates", "POS setup"],
          },
          {
            callNumber: 5,
            title: "Online Presence",
            mustCoverTopics: ["Instagram audit", "Google Business Profile", "website review", "brand consistency", "30-day content plan"],
            expectedHomeworkReviewed: "Previous action items",
            actionItemsToAssign: ["Profile updates", "brand photo audit", "website copy", "GMB calendar"],
          },
          {
            callNumber: 6,
            title: "Marketing Systems",
            mustCoverTopics: ["Email platform setup", "welcome sequence", "review automation", "referral program", "photo protocol", "90-day calendar"],
            expectedHomeworkReviewed: "Previous action items",
            actionItemsToAssign: ["Email sequences", "review automation", "referral launch", "photo system"],
          },
          {
            callNumber: 7,
            title: "Sales Process",
            mustCoverTopics: ["Consultation framework", "sales training outline", "conversion tracking", "follow-up systems", "objection handling", "client acquisition cost"],
            expectedHomeworkReviewed: "Previous action items",
            actionItemsToAssign: ["Consultation script", "team training scheduled", "tracking spreadsheet", "follow-up automation"],
          },
          {
            callNumber: 8,
            title: "Client Journey & Retention",
            mustCoverTopics: ["Client journey mapping", "retention program", "re-engagement campaign", "communication calendar", "win-back offer", "retention benchmarks"],
            expectedHomeworkReviewed: "Previous action items",
            actionItemsToAssign: ["Journey map", "retention build-out", "communication sequences", "re-engagement launch"],
          },
          {
            callNumber: 9,
            title: "Hiring & Onboarding",
            mustCoverTopics: ["Job descriptions", "hiring process framework", "interview bank", "onboarding system", "training protocols"],
            expectedHomeworkReviewed: "Previous action items",
            actionItemsToAssign: ["Job descriptions", "hiring timeline", "onboarding checklist", "training manual started"],
          },
          {
            callNumber: 10,
            title: "Leadership & Team Culture",
            mustCoverTopics: ["Daily huddle structure", "meeting agendas", "motivation systems", "communication protocols", "culture definition", "feedback frameworks"],
            expectedHomeworkReviewed: "Previous action items",
            actionItemsToAssign: ["Meeting templates", "huddle implementation", "recognition program", "culture doc"],
          },
          {
            callNumber: 11,
            title: "Team Compensation & Growth",
            mustCoverTopics: ["Compensation review", "growth plan framework", "review/raise system", "non-monetary retention", "appreciation calendar"],
            expectedHomeworkReviewed: "Previous action items",
            actionItemsToAssign: ["Compensation audit", "growth plan templates", "review schedule", "appreciation program"],
          },
          {
            callNumber: 12,
            title: "Team Optimization",
            mustCoverTopics: ["Staff development systems", "schedule optimization", "service assignment strategy", "productivity metrics", "capacity analysis"],
            expectedHomeworkReviewed: "Previous action items",
            actionItemsToAssign: ["Development plans per member", "schedule template", "capacity calculator", "productivity dashboard"],
          },
          {
            callNumber: 13,
            title: "Tech Stack & PM",
            mustCoverTopics: ["Monday.com", "Google Drive org", "Loom for training", "Slack setup", "integration opportunities"],
            expectedHomeworkReviewed: "Previous action items",
            actionItemsToAssign: ["Monday.com boards", "Drive structure", "first Loom recorded", "tech stack doc"],
          },
          {
            callNumber: 14,
            title: "Lead Gen & Capacity",
            mustCoverTopics: ["Lead flow strategy", "team utilization analysis", "CAC vs LTV", "hiring triggers", "90-day growth roadmap"],
            expectedHomeworkReviewed: "Previous action items",
            actionItemsToAssign: ["Lead flow calendar", "capacity calculator", "hiring triggers", "90-day action plan"],
          },
          {
            callNumber: "bonus",
            title: "Flexible Deep-Dive",
            mustCoverTopics: ["Topic-specific (designated for this call)"],
            expectedHomeworkReviewed: "Previous action items",
            actionItemsToAssign: ["Topic-specific action items"],
          },
        ],
        googleDocsSlot: "google_docs",
        resendFromEmail: "reports@smartscale.com",
        coachFeedbackEmailTemplate: "coach_feedback",
      },

      pipelineSteps: [
        {
          slug: "intake",
          displayName: "Intake",
          promptTemplate:
            "Process the coaching call transcript. " +
            "If provided as a VTT file, strip timestamps and preserve speaker labels. " +
            "Compute coach talk percentage from speaker timestamps. " +
            "Store the transcript and return the storageId.",
          order: 0,
        },
        {
          slug: "analyze",
          displayName: "Analyze",
          promptTemplate:
            "Analyze the coaching call transcript against the curriculum entry for this call number " +
            "and the rubric dimensions. Score each dimension, provide evidence-based notes, " +
            "write highlights, concerns, and a 3-paragraph narrative. " +
            "Return a structured JSON result matching the AnalysisResultSchema.",
          order: 1,
          model: "claude-sonnet-4-6",
        },
        {
          slug: "format",
          displayName: "Format",
          promptTemplate:
            "Format the analysis into a clean human-readable report. " +
            "Create a Google Doc via the google_docs integration slot. " +
            "Write a scorecard table, highlights, concerns, and the narrative to the doc. " +
            "Return the Google Doc URL.",
          order: 2,
        },
        {
          slug: "deliver",
          displayName: "Deliver",
          promptTemplate:
            "Update the coaching call report with final scores and status. " +
            "If the call is flagged (score below threshold), send an email notification " +
            "to the program admin via Resend with the Google Doc link.",
          order: 3,
        },
      ],

      createdBy: args.createdByUserId,
      createdAt: now,
      updatedAt: now,
    });

    return { created: true, templateId };
  },
});
