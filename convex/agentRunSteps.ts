import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

export const listAgentRunSteps = query({
  args: {
    runId: v.id("agentRuns"),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    // Verify caller has access to the parent run's tenant
    const run = await ctx.db.get(args.runId);
    if (!run) {
      return [];
    }

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

    const steps = await ctx.db
      .query("agentRunSteps")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .collect();

    return steps.sort((a, b) => a.stepOrder - b.stepOrder);
  },
});
