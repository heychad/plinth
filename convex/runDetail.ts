import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

/**
 * getRunDetail — composite query for the run detail page.
 * Args: { runId }
 * Returns: { run, agentName, steps }
 * Auth: consultant must own the tenant, or client must be in the tenant.
 */
export const getRunDetail = query({
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

    // Resolve agentName from agentConfig → agentTemplate
    const agentConfig = await ctx.db.get(run.agentConfigId);
    let agentName = agentConfig?.displayName ?? "Unknown Agent";
    if (agentConfig) {
      const template = await ctx.db.get(agentConfig.templateId);
      if (template) {
        // Use config displayName (which may be customized per tenant) — template name as fallback
        agentName = agentConfig.displayName;
      }
    }

    // Get all steps for this run ordered by stepOrder ascending
    const steps = await ctx.db
      .query("agentRunSteps")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .collect();

    steps.sort((a, b) => a.stepOrder - b.stepOrder);

    return {
      run,
      agentName,
      steps,
    };
  },
});
