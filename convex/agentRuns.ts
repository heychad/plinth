import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";
import { workflowManager } from "./execution/agentWorkflow";
import { simpleWorkflowManager } from "./execution/simpleWorkflow";
import { internal } from "./_generated/api";

export const triggerAgentRun = mutation({
  args: {
    agentConfigId: v.id("agentConfigs"),
    input: v.any(),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

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

    // Validate required fields from inputSchema
    if (template.inputSchema && typeof template.inputSchema === "object") {
      const schema = template.inputSchema as Record<string, { required?: boolean }>;
      for (const [fieldName, fieldDef] of Object.entries(schema)) {
        if (
          fieldDef &&
          typeof fieldDef === "object" &&
          fieldDef.required === true &&
          (args.input === null ||
            args.input === undefined ||
            !(fieldName in (args.input as Record<string, unknown>)))
        ) {
          throw new Error(`Missing required input field: ${fieldName}`);
        }
      }
    }

    // Verify caller authorization
    if (auth.role === "client") {
      if (auth.tenantId !== config.tenantId) {
        throw new Error("Not authorized");
      }
    } else if (auth.role === "consultant") {
      const tenant = await ctx.db.get(config.tenantId);
      if (!tenant || tenant.consultantId !== auth.consultantId) {
        throw new Error("Not authorized");
      }
    }
    // platform_admin has no restrictions

    // Look up the caller's user record for triggeredBy
    const identity = await ctx.auth.getUserIdentity();
    const callerUser = identity
      ? await ctx.db
          .query("users")
          .withIndex("by_clerkUserId", (q) =>
            q.eq("clerkUserId", identity.subject)
          )
          .unique()
      : null;

    const now = Date.now();
    const runId = await ctx.db.insert("agentRuns", {
      agentConfigId: args.agentConfigId,
      tenantId: config.tenantId,
      status: "queued",
      triggerType: "manual",
      triggeredBy: callerUser?._id,
      input: args.input,
      workflowId: undefined,
      totalTokensIn: 0,
      totalTokensOut: 0,
      totalCostUsd: 0,
      queuedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Schedule the appropriate workflow based on the template's executionMode
    let workflowId: string;
    if (template.executionMode === "simple") {
      workflowId = await simpleWorkflowManager.start(
        ctx,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (internal as any).execution.simpleWorkflow.simpleWorkflow,
        { runId }
      );
    } else {
      // Default: "autonomous" mode using Agent SDK
      workflowId = await workflowManager.start(
        ctx,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (internal as any).execution.agentWorkflow.agentWorkflow,
        { runId }
      );
    }

    // Store the workflowId on the run record for status tracking and cancellation
    await ctx.db.patch(runId, { workflowId });

    return runId;
  },
});

export const getAgentRun = query({
  args: {
    runId: v.id("agentRuns"),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    const run = await ctx.db.get(args.runId);
    if (!run) {
      return null;
    }

    // Verify caller access
    if (auth.role === "client") {
      if (auth.tenantId !== run.tenantId) {
        throw new Error("Not authorized");
      }
    } else if (auth.role === "consultant") {
      const tenant = await ctx.db.get(run.tenantId);
      if (!tenant || tenant.consultantId !== auth.consultantId) {
        throw new Error("Not authorized");
      }
    }
    // platform_admin has no restrictions

    return run;
  },
});

export const listAgentRunsForTenant = query({
  args: {
    tenantId: v.id("tenants"),
    agentConfigId: v.optional(v.id("agentConfigs")),
    status: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    // Verify caller access to tenant
    if (auth.role === "client") {
      if (auth.tenantId !== args.tenantId) {
        throw new Error("Not authorized");
      }
    } else if (auth.role === "consultant") {
      const tenant = await ctx.db.get(args.tenantId);
      if (!tenant || tenant.consultantId !== auth.consultantId) {
        throw new Error("Not authorized");
      }
    }
    // platform_admin has no restrictions

    if (args.agentConfigId) {
      return await ctx.db
        .query("agentRuns")
        .withIndex("by_agentConfigId", (q) =>
          q.eq("agentConfigId", args.agentConfigId!)
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }

    return await ctx.db
      .query("agentRuns")
      .withIndex("by_tenantId_createdAt", (q) =>
        q.eq("tenantId", args.tenantId)
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const cancelAgentRun = mutation({
  args: {
    runId: v.id("agentRuns"),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    const run = await ctx.db.get(args.runId);
    if (!run) {
      throw new Error("Agent run not found");
    }

    // Verify caller access
    if (auth.role === "client") {
      if (auth.tenantId !== run.tenantId) {
        throw new Error("Not authorized");
      }
    } else if (auth.role === "consultant") {
      const tenant = await ctx.db.get(run.tenantId);
      if (!tenant || tenant.consultantId !== auth.consultantId) {
        throw new Error("Not authorized");
      }
    }
    // platform_admin has no restrictions

    const terminalStatuses = ["completed", "failed", "cancelled"];
    if (terminalStatuses.includes(run.status)) {
      throw new Error("Cannot cancel run in terminal state");
    }

    const now = Date.now();

    // Cancel the Convex workflow if one is running
    if (run.workflowId) {
      try {
        // Try agent workflow manager first; if the run used simple mode the
        // cancel call is identical (both point to the same component).
        await workflowManager.cancel(ctx, run.workflowId as any);
      } catch {
        // If cancellation fails (e.g. already completed), we still mark
        // the run as cancelled in our DB.
      }
    }

    await ctx.db.patch(args.runId, {
      status: "cancelled",
      completedAt: now,
      updatedAt: now,
    });
  },
});

export const updateRunStatus = internalMutation({
  args: {
    runId: v.id("agentRuns"),
    status: v.string(),
    output: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
    errorDetail: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) {
      throw new Error("Agent run not found");
    }

    const now = Date.now();
    const terminalStatuses = ["completed", "failed", "cancelled"];
    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
    };

    if (args.output !== undefined) {
      patch.output = args.output;
    }
    if (args.errorMessage !== undefined) {
      patch.errorMessage = args.errorMessage;
    }
    if (args.errorDetail !== undefined) {
      patch.errorDetail = args.errorDetail;
    }

    if (args.status === "running") {
      patch.startedAt = now;
    }

    if (terminalStatuses.includes(args.status)) {
      patch.completedAt = now;
      if (run.startedAt) {
        patch.durationMs = now - run.startedAt;
      }

      // Accumulate token totals from child agentRunSteps
      const steps = await ctx.db
        .query("agentRunSteps")
        .withIndex("by_runId", (q) => q.eq("runId", args.runId))
        .collect();

      let totalTokensIn = 0;
      let totalTokensOut = 0;
      let totalCostUsd = 0;
      for (const step of steps) {
        totalTokensIn += step.promptTokens;
        totalTokensOut += step.completionTokens;
        totalCostUsd += step.costUsd;
      }
      patch.totalTokensIn = totalTokensIn;
      patch.totalTokensOut = totalTokensOut;
      patch.totalCostUsd = totalCostUsd;
    }

    await ctx.db.patch(args.runId, patch);
  },
});

/**
 * Internal query: fetch a single agentRun by ID.
 * Used by workflow handlers to read run state at the start of execution.
 */
export const getById = internalQuery({
  args: {
    runId: v.id("agentRuns"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.runId);
  },
});
