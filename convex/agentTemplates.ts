import { query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

export const listAgentTemplates = query({
  args: {
    category: v.optional(
      v.union(
        v.literal("marketing"),
        v.literal("sales"),
        v.literal("operations"),
        v.literal("coaching")
      )
    ),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    if (args.category) {
      return await ctx.db
        .query("agentTemplates")
        .withIndex("by_category_isActive", (q) =>
          q.eq("category", args.category!).eq("isActive", true)
        )
        .paginate(args.paginationOpts);
    }

    // No category filter — scan all active templates
    return await ctx.db
      .query("agentTemplates")
      .filter((q) => q.eq(q.field("isActive"), true))
      .paginate(args.paginationOpts);
  },
});
