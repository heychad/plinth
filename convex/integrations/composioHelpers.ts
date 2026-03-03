import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

/**
 * Internal query to resolve auth context for the initiateComposioOAuth action.
 * Checks whether the caller (identified by clerkUserId) has access to the given tenant.
 *
 * Separated from composio.ts because "use node" files cannot define queries.
 */
export const getAuthInfoForAction = internalQuery({
  args: {
    clerkUserId: v.string(),
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args): Promise<{ authorized: boolean }> => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();

    if (!user) {
      return { authorized: false };
    }

    if (user.role === "client") {
      return { authorized: user.tenantId === args.tenantId };
    }

    if (user.role === "consultant") {
      const tenant = await ctx.db.get(args.tenantId);
      if (!tenant) return { authorized: false };
      return { authorized: tenant.consultantId === user.consultantId };
    }

    // platform_admin
    return { authorized: true };
  },
});
