import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { workflowManager } from "../execution/agentWorkflow";
import { simpleWorkflowManager } from "../execution/simpleWorkflow";

/**
 * Queries/mutations extracted from integrations/zoom.ts because
 * "use node" files cannot define queries or mutations.
 */

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
    const configs = await ctx.db
      .query("agentConfigs")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
      .filter((q) => q.eq(q.field("status"), "deployed"))
      .collect();

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
