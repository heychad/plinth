import { v } from "convex/values";
import { internalQuery, internalMutation } from "../_generated/server";

/**
 * Queries/mutations extracted from googleDocs.ts because
 * "use node" files cannot define queries or mutations.
 */

export const getCredentialBySlot = internalQuery({
  args: {
    tenantId: v.id("tenants"),
    slotName: v.string(),
  },
  handler: async (ctx, { tenantId, slotName }) => {
    return await ctx.db
      .query("credentials")
      .withIndex("by_tenantId_slotName", (q) =>
        q.eq("tenantId", tenantId).eq("slotName", slotName)
      )
      .unique();
  },
});

export const touchCredentialLastUsed = internalMutation({
  args: { credentialId: v.id("credentials") },
  handler: async (ctx, { credentialId }) => {
    await ctx.db.patch(credentialId, {
      lastUsedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
