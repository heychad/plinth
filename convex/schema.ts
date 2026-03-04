import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ─── Item 1: platform-foundation ─────────────────────────────────────────

  consultants: defineTable({
    clerkUserId: v.string(),
    displayName: v.string(),
    businessName: v.string(),
    email: v.string(),
    plan: v.union(
      v.literal("starter"),
      v.literal("growth"),
      v.literal("scale")
    ),
    planExpiresAt: v.optional(v.number()),
    supportEmail: v.optional(v.string()),
    clerkOrgId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerkUserId", ["clerkUserId"])
    .index("by_email", ["email"]),

  tenants: defineTable({
    consultantId: v.id("consultants"),
    businessName: v.string(),
    ownerName: v.string(),
    ownerEmail: v.string(),
    logoUrl: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    vertical: v.optional(
      v.union(
        v.literal("spa"),
        v.literal("course"),
        v.literal("speaker"),
        v.literal("consultant"),
        v.literal("other")
      )
    ),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("churned")
    ),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_consultantId", ["consultantId"])
    .index("by_consultantId_ownerEmail", ["consultantId", "ownerEmail"]),

  users: defineTable({
    clerkUserId: v.string(),
    tenantId: v.optional(v.id("tenants")),
    consultantId: v.optional(v.id("consultants")),
    role: v.union(
      v.literal("client"),
      v.literal("consultant"),
      v.literal("platform_admin")
    ),
    displayName: v.string(),
    email: v.string(),
    avatarUrl: v.optional(v.string()),
    lastSignInAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_clerkUserId", ["clerkUserId"])
    .index("by_email", ["email"])
    .index("by_tenantId", ["tenantId"])
    .index("by_consultantId", ["consultantId"]),

  usageLogs: defineTable({
    tenantId: v.id("tenants"),
    consultantId: v.id("consultants"),
    agentConfigId: v.optional(v.id("agentConfigs")),
    agentRunId: v.optional(v.id("agentRuns")),
    loggedDate: v.string(),
    tokensIn: v.number(),
    tokensOut: v.number(),
    costUsd: v.number(),
    runCount: v.number(),
    createdAt: v.number(),
  })
    .index("by_tenantId", ["tenantId"])
    .index("by_consultantId", ["consultantId"])
    .index("by_tenantId_loggedDate", ["tenantId", "loggedDate"]),

  // ─── Item 4: white-label-theming ─────────────────────────────────────────

  themes: defineTable({
    consultantId: v.id("consultants"),
    platformName: v.string(),
    logoUrl: v.optional(v.string()),
    faviconUrl: v.optional(v.string()),
    primaryColor: v.string(),
    secondaryColor: v.string(),
    accentColor: v.string(),
    backgroundColor: v.string(),
    textColor: v.string(),
    fontFamily: v.string(),
    customDomain: v.optional(v.string()),
    supportEmail: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_consultantId", ["consultantId"]),

  // ─── Item 5: agent-config-system ─────────────────────────────────────────

  agentTemplates: defineTable({
    slug: v.string(),
    displayName: v.string(),
    description: v.string(),
    category: v.union(
      v.literal("marketing"),
      v.literal("sales"),
      v.literal("operations"),
      v.literal("coaching"),
      v.literal("general")
    ),
    version: v.number(),
    isActive: v.boolean(),
    isPipeline: v.boolean(),
    executionMode: v.union(v.literal("autonomous"), v.literal("simple")),
    estimatedDurationSeconds: v.optional(v.number()),
    systemPrompt: v.string(),
    integrationSlots: v.array(v.string()),
    inputSchema: v.any(),
    defaultLockedFields: v.array(v.string()),
    defaultCustomizableFields: v.array(v.string()),
    defaultConfig: v.any(),
    pipelineSteps: v.optional(
      v.array(
        v.object({
          slug: v.string(),
          displayName: v.string(),
          promptTemplate: v.string(),
          order: v.number(),
          model: v.optional(v.string()),
        })
      )
    ),
    toolDefinitions: v.optional(
      v.array(
        v.object({
          name: v.string(),
          description: v.string(),
          inputSchema: v.any(),
          handlerRef: v.string(),
        })
      )
    ),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_category_isActive", ["category", "isActive"]),

  agentConfigs: defineTable({
    tenantId: v.id("tenants"),
    templateId: v.id("agentTemplates"),
    displayName: v.string(),
    status: v.union(
      v.literal("building"),
      v.literal("testing"),
      v.literal("deployed"),
      v.literal("paused"),
      v.literal("archived")
    ),
    config: v.any(),
    lockedFields: v.array(v.string()),
    customizableFields: v.array(v.string()),
    modelOverride: v.optional(v.string()),
    scheduleCron: v.optional(v.string()),
    scheduleTimezone: v.string(),
    deployedAt: v.optional(v.number()),
    deployedBy: v.optional(v.id("users")),
    version: v.number(),
    updatedByType: v.union(
      v.literal("admin"),
      v.literal("client"),
      v.literal("template_sync")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenantId", ["tenantId"])
    .index("by_templateId", ["templateId"])
    .index("by_tenantId_templateId", ["tenantId", "templateId"]),

  agentConfigHistory: defineTable({
    agentConfigId: v.id("agentConfigs"),
    tenantId: v.id("tenants"),
    changedByUserId: v.optional(v.id("users")),
    changedByType: v.union(
      v.literal("admin"),
      v.literal("client"),
      v.literal("template_sync")
    ),
    previousConfig: v.any(),
    newConfig: v.any(),
    changeSummary: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_agentConfigId", ["agentConfigId"]),

  // ─── Item 8: agent-execution-engine ──────────────────────────────────────

  agentRuns: defineTable({
    agentConfigId: v.id("agentConfigs"),
    tenantId: v.id("tenants"),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    triggerType: v.union(
      v.literal("manual"),
      v.literal("scheduled"),
      v.literal("webhook")
    ),
    triggeredBy: v.optional(v.id("users")),
    input: v.any(),
    output: v.optional(v.any()),
    workflowId: v.optional(v.string()),
    totalTokensIn: v.number(),
    totalTokensOut: v.number(),
    totalCostUsd: v.number(),
    queuedAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    errorDetail: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_agentConfigId", ["agentConfigId"])
    .index("by_tenantId_status", ["tenantId", "status"])
    .index("by_tenantId_createdAt", ["tenantId", "createdAt"]),

  agentRunSteps: defineTable({
    runId: v.id("agentRuns"),
    tenantId: v.id("tenants"),
    stepSlug: v.string(),
    stepDisplayName: v.string(),
    stepOrder: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("skipped")
    ),
    modelUsed: v.optional(v.string()),
    promptTokens: v.number(),
    completionTokens: v.number(),
    costUsd: v.number(),
    output: v.optional(v.any()),
    rawResponse: v.optional(v.any()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_runId", ["runId"]),

  // ─── UI Sprint Item 4: conversations + messages ─────────────────────────

  conversations: defineTable({
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    agentConfigId: v.union(v.id("agentConfigs"), v.null()),
    title: v.string(),
    lastMessageAt: v.number(),
    messageCount: v.number(),
    platform: v.string(),
    status: v.union(v.literal("active"), v.literal("archived")),
    createdAt: v.number(),
  })
    .index("by_userId_lastMessageAt", ["userId", "lastMessageAt"])
    .index("by_tenantId_userId", ["tenantId", "userId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    tenantId: v.id("tenants"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system")
    ),
    content: v.string(),
    streamingToken: v.union(v.string(), v.null()),
    isStreaming: v.boolean(),
    agentConfigId: v.union(v.id("agentConfigs"), v.null()),
    agentRunId: v.union(v.id("agentRuns"), v.null()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_conversationId", ["conversationId"])
    .index("by_conversationId_createdAt", ["conversationId", "createdAt"]),

  // ─── UI Sprint Item 5: documents ───────────────────────────────────────

  documents: defineTable({
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    title: v.string(),
    content: v.union(v.string(), v.null()),
    storageId: v.union(v.string(), v.null()),
    mimeType: v.string(),
    source: v.union(v.literal("user"), v.literal("agent")),
    agentRunId: v.union(v.id("agentRuns"), v.null()),
    agentConfigId: v.union(v.id("agentConfigs"), v.null()),
    googleDocUrl: v.union(v.string(), v.null()),
    wordCount: v.union(v.number(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenantId_createdAt", ["tenantId", "createdAt"])
    .index("by_tenantId_userId", ["tenantId", "userId"])
    .index("by_agentRunId", ["agentRunId"]),

  // ─── Item 12: coaching-call-analyzer ──────────────────────────────────────

  coachingCallReports: defineTable({
    tenantId: v.id("tenants"),
    agentRunId: v.id("agentRuns"),
    coachId: v.string(),
    coachName: v.optional(v.string()),
    studentId: v.optional(v.string()),
    studentName: v.optional(v.string()),
    callNumber: v.union(
      v.number(),
      v.literal("onboarding"),
      v.literal("bonus")
    ),
    zoomMeetingId: v.optional(v.string()),
    recordedAt: v.optional(v.number()),
    durationMinutes: v.optional(v.number()),
    transcriptStorageId: v.string(),
    parsedTranscript: v.optional(v.string()),
    overallScore: v.number(),
    dimensionScores: v.any(),
    highlights: v.array(v.string()),
    concerns: v.array(v.string()),
    narrative: v.string(),
    coachTalkPercent: v.optional(v.number()),
    flagged: v.boolean(),
    status: v.union(
      v.literal("draft"),
      v.literal("reviewed"),
      v.literal("sent"),
      v.literal("no_action")
    ),
    editedNarrative: v.optional(v.string()),
    releasedToCoach: v.boolean(),
    sentAt: v.optional(v.number()),
    rawAnalysisJson: v.any(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenantId_status", ["tenantId", "status"])
    .index("by_tenantId_coachId", ["tenantId", "coachId"])
    .index("by_tenantId_flagged", ["tenantId", "flagged"])
    .index("by_agentRunId", ["agentRunId"]),

  // ─── Item 14: output-integrations ─────────────────────────────────────────

  credentials: defineTable({
    tenantId: v.id("tenants"),
    slotName: v.string(),
    provider: v.string(),
    composioEntityId: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("expired"),
      v.literal("revoked"),
      v.literal("error")
    ),
    connectedAt: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_tenantId_slotName", ["tenantId", "slotName"]),

  // ─── Items 17, 18, 38: zoom-integration ──────────────────────────────────

  zoomCredentials: defineTable({
    tenantId: v.id("tenants"),
    accountId: v.string(),
    clientId: v.string(),
    clientSecret: v.string(), // encrypted
    webhookSecretToken: v.string(), // encrypted
    accessToken: v.optional(v.string()), // encrypted, cached
    accessTokenExpiresAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_tenantId", ["tenantId"]),

  zoomWebhookEvents: defineTable({
    tenantId: v.id("tenants"),
    zoomMeetingId: v.string(),
    eventType: v.string(),
    zoomUserId: v.string(),
    rawPayload: v.any(),
    processed: v.boolean(),
    processedAt: v.optional(v.number()),
    agentRunId: v.optional(v.id("agentRuns")),
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_zoomMeetingId", ["zoomMeetingId"])
    .index("by_tenantId_processed", ["tenantId", "processed"]),

  // ─── UI Sprint Item 6: invitations ────────────────────────────────────

  invitations: defineTable({
    tenantId: v.id("tenants"),
    consultantId: v.id("consultants"),
    email: v.string(),
    displayName: v.union(v.string(), v.null()),
    clerkInvitationId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("revoked"),
      v.literal("expired")
    ),
    sentAt: v.number(),
    acceptedAt: v.union(v.number(), v.null()),
    createdAt: v.number(),
  })
    .index("by_tenantId_status", ["tenantId", "status"])
    .index("by_clerkInvitationId", ["clerkInvitationId"]),
});
