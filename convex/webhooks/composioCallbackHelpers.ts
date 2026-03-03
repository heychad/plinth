import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Mutation extracted from composioCallback.ts because
 * "use node" files cannot define mutations.
 */

export const setCredentialStatus = internalMutation({
  args: {
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
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("credentials")
      .withIndex("by_tenantId_slotName", (q) =>
        q.eq("tenantId", args.tenantId).eq("slotName", args.slotName)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        provider: args.provider,
        composioEntityId: args.composioEntityId ?? existing.composioEntityId,
        status: args.status,
        connectedAt: args.connectedAt ?? existing.connectedAt,
        errorMessage: args.errorMessage,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("credentials", {
        tenantId: args.tenantId,
        slotName: args.slotName,
        provider: args.provider,
        composioEntityId: args.composioEntityId,
        status: args.status,
        connectedAt: args.connectedAt,
        errorMessage: args.errorMessage,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});
