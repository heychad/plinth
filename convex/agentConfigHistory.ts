import { query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

export const getAgentConfigHistory = query({
  args: {
    agentConfigId: v.id("agentConfigs"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    const config = await ctx.db.get(args.agentConfigId);
    if (!config) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    // Auth: consultant who owns the tenant, or platform_admin
    if (auth.role === "consultant") {
      const tenant = await ctx.db.get(config.tenantId);
      if (!tenant || tenant.consultantId !== auth.consultantId) {
        throw new Error("Not authorized");
      }
    } else if (auth.role !== "platform_admin") {
      throw new Error("Not authorized");
    }

    return await ctx.db
      .query("agentConfigHistory")
      .withIndex("by_agentConfigId", (q) =>
        q.eq("agentConfigId", args.agentConfigId)
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
