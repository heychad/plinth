import { internalMutation } from "./_generated/server";

/**
 * Idempotent seed mutation for E2E tests.
 * Creates a test consultant, tenant, agent template, config, runs, steps,
 * and two coaching call reports (one green score, one flagged).
 *
 * Skips if test_consultant_001 user already exists.
 */
export const seedAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Idempotency check
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) =>
        q.eq("clerkUserId", "test_consultant_001")
      )
      .unique();

    if (existing) {
      return { status: "already_seeded" };
    }

    const now = Date.now();
    const oneHourAgo = now - 3600 * 1000;
    const twoHoursAgo = now - 7200 * 1000;

    // 1. Consultant
    const consultantId = await ctx.db.insert("consultants", {
      clerkUserId: "test_consultant_001",
      displayName: "Test Consultant",
      businessName: "Growth Factor Coaching",
      email: "test@onplinth.ai",
      plan: "growth",
      createdAt: now,
      updatedAt: now,
    });

    // 2. User (consultant role, linked to consultant)
    await ctx.db.insert("users", {
      clerkUserId: "test_consultant_001",
      consultantId,
      role: "consultant",
      displayName: "Test Consultant",
      email: "test@onplinth.ai",
      createdAt: now,
    });

    // 3. Tenant
    const tenantId = await ctx.db.insert("tenants", {
      consultantId,
      businessName: "Growth Factor Coaching",
      ownerName: "Jane Owner",
      ownerEmail: "jane@growthfactor.io",
      status: "active",
      vertical: "consultant",
      createdAt: now,
      updatedAt: now,
    });

    // 4. Create a user for createdBy on agent template
    const templateCreatorId = await ctx.db.insert("users", {
      clerkUserId: "test_template_creator",
      consultantId,
      role: "platform_admin",
      displayName: "Template Creator",
      email: "admin@onplinth.ai",
      createdAt: now,
    });

    // 5. Agent template (coaching-call-analyzer)
    const templateId = await ctx.db.insert("agentTemplates", {
      slug: "coaching-call-analyzer",
      displayName: "Coaching Call Analyzer",
      description: "Analyzes coaching call recordings and generates performance scorecards",
      category: "coaching",
      version: 1,
      isActive: true,
      isPipeline: true,
      executionMode: "autonomous",
      estimatedDurationSeconds: 300,
      systemPrompt: "You are a coaching call analyzer...",
      integrationSlots: ["zoom"],
      inputSchema: {},
      defaultLockedFields: ["systemPrompt", "pipelineSteps"],
      defaultCustomizableFields: ["rubricDimensions", "flagThreshold"],
      defaultConfig: {
        rubricDimensions: [
          { name: "Curriculum Adherence", maxScore: 25 },
          { name: "Homework", maxScore: 25 },
          { name: "Coaching Technique", maxScore: 25 },
          { name: "Client Progress", maxScore: 25 },
        ],
        flagThreshold: 70,
      },
      pipelineSteps: [
        {
          slug: "intake",
          displayName: "Intake & Transcription",
          promptTemplate: "Ingest the call recording and produce a transcript.",
          order: 1,
        },
        {
          slug: "analyze",
          displayName: "Rubric Analysis",
          promptTemplate: "Score the call against the rubric dimensions.",
          order: 2,
        },
        {
          slug: "report",
          displayName: "Report Generation",
          promptTemplate: "Generate the coaching feedback report.",
          order: 3,
        },
        {
          slug: "notify",
          displayName: "Notification",
          promptTemplate: "Send notification to consultant.",
          order: 4,
        },
      ],
      createdBy: templateCreatorId,
      createdAt: now,
      updatedAt: now,
    });

    // 6. Agent config (deployed)
    const agentConfigId = await ctx.db.insert("agentConfigs", {
      tenantId,
      templateId,
      displayName: "Coaching Call Analyzer",
      status: "deployed",
      config: {
        rubricDimensions: [
          { name: "Curriculum Adherence", maxScore: 25 },
          { name: "Homework", maxScore: 25 },
          { name: "Coaching Technique", maxScore: 25 },
          { name: "Client Progress", maxScore: 25 },
        ],
        flagThreshold: 70,
      },
      lockedFields: ["systemPrompt", "pipelineSteps"],
      customizableFields: ["rubricDimensions", "flagThreshold"],
      scheduleTimezone: "America/New_York",
      version: 1,
      updatedByType: "admin",
      deployedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // 7. Agent Run #1 — high score, NOT flagged
    const runId1 = await ctx.db.insert("agentRuns", {
      agentConfigId,
      tenantId,
      status: "completed",
      triggerType: "webhook",
      input: { zoomMeetingId: "test-meeting-001" },
      output: { reportGenerated: true },
      totalTokensIn: 5000,
      totalTokensOut: 2000,
      totalCostUsd: 0.05,
      queuedAt: twoHoursAgo,
      startedAt: twoHoursAgo + 1000,
      completedAt: twoHoursAgo + 120000,
      durationMs: 119000,
      createdAt: twoHoursAgo,
      updatedAt: twoHoursAgo + 120000,
    });

    // Run #1 steps (4 completed steps)
    const steps1 = [
      { slug: "intake", displayName: "Intake & Transcription", order: 1 },
      { slug: "analyze", displayName: "Rubric Analysis", order: 2 },
      { slug: "report", displayName: "Report Generation", order: 3 },
      { slug: "notify", displayName: "Notification", order: 4 },
    ];
    for (const step of steps1) {
      await ctx.db.insert("agentRunSteps", {
        runId: runId1,
        tenantId,
        stepSlug: step.slug,
        stepDisplayName: step.displayName,
        stepOrder: step.order,
        status: "completed",
        modelUsed: "claude-sonnet-4-6",
        promptTokens: 1250,
        completionTokens: 500,
        costUsd: 0.0125,
        startedAt: twoHoursAgo + step.order * 25000,
        completedAt: twoHoursAgo + step.order * 25000 + 20000,
        durationMs: 20000,
        createdAt: twoHoursAgo + step.order * 25000,
      });
    }

    // Report #1 — score 82, NOT flagged
    await ctx.db.insert("coachingCallReports", {
      tenantId,
      agentRunId: runId1,
      coachId: "coach_sarah",
      coachName: "Sarah Johnson",
      studentId: "student_mike",
      studentName: "Mike Chen",
      callNumber: 3,
      recordedAt: twoHoursAgo,
      durationMinutes: 45,
      transcriptStorageId: "test_transcript_placeholder_001",
      overallScore: 82,
      dimensionScores: {
        "Curriculum Adherence": { score: 22, maxScore: 25 },
        "Homework": { score: 20, maxScore: 25 },
        "Coaching Technique": { score: 21, maxScore: 25 },
        "Client Progress": { score: 19, maxScore: 25 },
      },
      highlights: [
        "Excellent use of open-ended questioning throughout the session",
        "Strong follow-up on previous action items",
      ],
      concerns: [
        "Could improve time management — ran 5 minutes over",
      ],
      narrative:
        "Sarah demonstrated strong coaching skills in this session. She effectively guided Mike through the curriculum material while maintaining an engaging dialogue. The homework review was thorough and well-structured.",
      coachTalkPercent: 38,
      flagged: false,
      status: "draft",
      releasedToCoach: false,
      rawAnalysisJson: { model: "test", version: "1.0" },
      createdAt: twoHoursAgo,
      updatedAt: twoHoursAgo,
    });

    // 8. Agent Run #2 — low score, flagged
    const runId2 = await ctx.db.insert("agentRuns", {
      agentConfigId,
      tenantId,
      status: "completed",
      triggerType: "webhook",
      input: { zoomMeetingId: "test-meeting-002" },
      output: { reportGenerated: true },
      totalTokensIn: 4800,
      totalTokensOut: 1900,
      totalCostUsd: 0.04,
      queuedAt: oneHourAgo,
      startedAt: oneHourAgo + 1000,
      completedAt: oneHourAgo + 110000,
      durationMs: 109000,
      createdAt: oneHourAgo,
      updatedAt: oneHourAgo + 110000,
    });

    // Run #2 steps
    for (const step of steps1) {
      await ctx.db.insert("agentRunSteps", {
        runId: runId2,
        tenantId,
        stepSlug: step.slug,
        stepDisplayName: step.displayName,
        stepOrder: step.order,
        status: "completed",
        modelUsed: "claude-sonnet-4-6",
        promptTokens: 1200,
        completionTokens: 475,
        costUsd: 0.01,
        startedAt: oneHourAgo + step.order * 22000,
        completedAt: oneHourAgo + step.order * 22000 + 18000,
        durationMs: 18000,
        createdAt: oneHourAgo + step.order * 22000,
      });
    }

    // Report #2 — score 58, flagged
    await ctx.db.insert("coachingCallReports", {
      tenantId,
      agentRunId: runId2,
      coachId: "coach_sarah",
      coachName: "Sarah Johnson",
      studentId: "student_alex",
      studentName: "Alex Rivera",
      callNumber: 1,
      recordedAt: oneHourAgo,
      durationMinutes: 30,
      transcriptStorageId: "test_transcript_placeholder_002",
      overallScore: 58,
      dimensionScores: {
        "Curriculum Adherence": { score: 15, maxScore: 25 },
        "Homework": { score: 10, maxScore: 25 },
        "Coaching Technique": { score: 18, maxScore: 25 },
        "Client Progress": { score: 15, maxScore: 25 },
      },
      highlights: [
        "Attempted to re-engage the student after initial resistance",
      ],
      concerns: [
        "Homework was not reviewed — student reported not completing it",
        "Session ended 15 minutes early without covering planned material",
        "Coach dominated conversation with a 62% talk ratio",
      ],
      narrative:
        "This session raised several concerns. The student did not complete the assigned homework, and the coach did not adequately address the gap. The session ended early and key curriculum points were missed.",
      coachTalkPercent: 62,
      flagged: true,
      status: "draft",
      releasedToCoach: false,
      rawAnalysisJson: { model: "test", version: "1.0" },
      createdAt: oneHourAgo,
      updatedAt: oneHourAgo,
    });

    // 9. General-assistant template (for provisionStarterAgent)
    await seedGeneralAssistantTemplate(ctx, templateCreatorId);

    return { status: "seeded" };
  },
});

/**
 * Idempotent seed for the general-assistant agent template.
 * Checks for existing slug before insert.
 */
async function seedGeneralAssistantTemplate(
  ctx: { db: import("./_generated/server").MutationCtx["db"] },
  createdBy: import("./_generated/dataModel").Id<"users">
) {
  const existing = await ctx.db
    .query("agentTemplates")
    .withIndex("by_slug", (q) => q.eq("slug", "general-assistant"))
    .first();

  if (existing) {
    return existing._id;
  }

  const now = Date.now();
  return await ctx.db.insert("agentTemplates", {
    slug: "general-assistant",
    displayName: "General Assistant",
    description: "A versatile AI assistant that can help with a wide range of tasks including writing, research, analysis, and problem-solving.",
    category: "general",
    version: 1,
    isActive: true,
    isPipeline: false,
    executionMode: "autonomous",
    systemPrompt: "You are a helpful AI assistant. Answer questions clearly and concisely, help with writing and analysis tasks, and provide actionable recommendations.",
    integrationSlots: [],
    inputSchema: {},
    defaultLockedFields: ["systemPrompt"],
    defaultCustomizableFields: ["greeting", "persona"],
    defaultConfig: {
      greeting: "Hello! How can I help you today?",
      persona: "professional",
    },
    createdBy,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Standalone idempotent seed for general-assistant template.
 * Can be called independently of seedAll.
 */
export const seedGeneralAssistant = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("agentTemplates")
      .withIndex("by_slug", (q) => q.eq("slug", "general-assistant"))
      .first();

    if (existing) {
      return { status: "already_exists", templateId: existing._id };
    }

    // Find or create a platform admin user for createdBy
    let adminUser = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", "system_seed"))
      .first();

    if (!adminUser) {
      const adminId = await ctx.db.insert("users", {
        clerkUserId: "system_seed",
        role: "platform_admin",
        displayName: "System",
        email: "system@onplinth.ai",
        createdAt: Date.now(),
      });
      adminUser = await ctx.db.get(adminId);
    }

    const templateId = await seedGeneralAssistantTemplate(ctx, adminUser!._id);
    return { status: "seeded", templateId };
  },
});
