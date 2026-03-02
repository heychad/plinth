import {
  query,
  mutation,
  internalMutation,
  internalAction,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";
import { internal } from "./_generated/api";

export class IntegrationNotConnectedError extends Error {
  constructor(slotName: string) {
    super(
      `Integration not connected: ${slotName}. Connect ${slotName} in the Integrations page.`
    );
    this.name = "IntegrationNotConnectedError";
  }
}

/**
 * Returns credential status for a single slot. Auth: tenant user or consultant who owns the tenant.
 */
export const getCredentialStatus = query({
  args: {
    tenantId: v.id("tenants"),
    slotName: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    // Validate caller has access to this tenant
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
    // platform_admin: no restriction

    const credential = await ctx.db
      .query("credentials")
      .withIndex("by_tenantId_slotName", (q) =>
        q.eq("tenantId", args.tenantId).eq("slotName", args.slotName)
      )
      .unique();

    if (!credential) {
      return null;
    }

    return {
      connected: credential.status === "active",
      status: credential.status,
      connectedAt: credential.connectedAt,
      lastUsedAt: credential.lastUsedAt,
    };
  },
});

/**
 * Returns all credentials for a tenant. Auth: tenant user or consultant who owns the tenant.
 */
export const listCredentialsForTenant = query({
  args: {
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

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

    return await ctx.db
      .query("credentials")
      .withIndex("by_tenantId_slotName", (q) =>
        q.eq("tenantId", args.tenantId)
      )
      .collect();
  },
});

/**
 * Sets a credential's status to "revoked". Composio revocation is handled separately.
 * Auth: tenant user or consultant who owns the tenant.
 */
export const disconnectCredential = mutation({
  args: {
    tenantId: v.id("tenants"),
    slotName: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

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

    const credential = await ctx.db
      .query("credentials")
      .withIndex("by_tenantId_slotName", (q) =>
        q.eq("tenantId", args.tenantId).eq("slotName", args.slotName)
      )
      .unique();

    if (!credential) {
      throw new Error(`Credential not found: ${args.slotName}`);
    }

    await ctx.db.patch(credential._id, {
      status: "revoked",
      updatedAt: Date.now(),
    });
  },
});

/**
 * Batch-resolves all credential slots needed for a pipeline.
 * Throws IntegrationNotConnectedError for any required slot not "active".
 * Called at pipeline start to prevent partial runs.
 */
export const resolveCredentials = internalAction({
  args: {
    tenantId: v.id("tenants"),
    slotNames: v.array(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<Record<string, { composioEntityId: string; status: string }>> => {
    const result: Record<
      string,
      { composioEntityId: string; status: string }
    > = {};

    for (const slotName of args.slotNames) {
      const credential = await ctx.runQuery(
        internal.credentials.getCredentialBySlot,
        { tenantId: args.tenantId, slotName }
      );

      if (!credential || credential.status !== "active") {
        throw new IntegrationNotConnectedError(slotName);
      }

      if (!credential.composioEntityId) {
        throw new IntegrationNotConnectedError(slotName);
      }

      result[slotName] = {
        composioEntityId: credential.composioEntityId,
        status: credential.status,
      };
    }

    return result;
  },
});

/**
 * Internal query helper: look up a credential by tenantId + slotName.
 * Used by resolveCredentials and OAuth callback.
 */
export const getCredentialBySlot = internalQuery({
  args: {
    tenantId: v.id("tenants"),
    slotName: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("credentials")
      .withIndex("by_tenantId_slotName", (q) =>
        q.eq("tenantId", args.tenantId).eq("slotName", args.slotName)
      )
      .unique();
  },
});

/**
 * Creates or updates a credential record for a tenant slot.
 * Used by the OAuth callback after successful Composio connection.
 */
export const upsertCredential = internalMutation({
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
    lastUsedAt: v.optional(v.number()),
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
        composioEntityId: args.composioEntityId,
        status: args.status,
        connectedAt: args.connectedAt,
        lastUsedAt: args.lastUsedAt,
        errorMessage: args.errorMessage,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("credentials", {
        tenantId: args.tenantId,
        slotName: args.slotName,
        provider: args.provider,
        composioEntityId: args.composioEntityId,
        status: args.status,
        connectedAt: args.connectedAt,
        lastUsedAt: args.lastUsedAt,
        errorMessage: args.errorMessage,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});
