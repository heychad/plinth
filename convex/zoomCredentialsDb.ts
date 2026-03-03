import {
  query,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import type { AuthResult } from "./auth";

/**
 * Pure DB queries/mutations extracted from zoomCredentials.ts because
 * "use node" files cannot define queries or mutations.
 * Functions that need Node.js crypto (encrypt/decrypt) stay in zoomCredentials.ts as actions.
 */

// ─── Public Queries ────────────────────────────────────────────────────────

export const getZoomConnectionStatus = query({
  args: {
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    if (user.role === "client") {
      if (user.tenantId !== args.tenantId) {
        throw new Error("Not authorized");
      }
    } else if (user.role === "consultant") {
      const tenant = await ctx.db.get(args.tenantId);
      if (!tenant || tenant.consultantId !== user.consultantId) {
        throw new Error("Not authorized");
      }
    }
    // platform_admin: no restriction

    const doc = await ctx.db
      .query("zoomCredentials")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
      .first();

    if (!doc) {
      return { connected: false };
    }

    return {
      connected: true,
      accountId: doc.accountId,
      lastUsedAt: doc.updatedAt,
    };
  },
});

// ─── Internal Queries ─────────────────────────────────────────────────────

export const getCallerAuth = internalQuery({
  args: {},
  handler: async (ctx): Promise<AuthResult | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .unique();

    if (!user) {
      return null;
    }

    return {
      clerkUserId: user.clerkUserId,
      role: user.role,
      tenantId: user.tenantId,
      consultantId: user.consultantId,
    };
  },
});

export const getTenantById = internalQuery({
  args: {
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.tenantId);
  },
});

export const getZoomCredentialsByAccountId = internalQuery({
  args: {
    accountId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("zoomCredentials")
      .filter((q) => q.eq(q.field("accountId"), args.accountId))
      .first();
  },
});

export const getZoomCredentialsByTenantId = internalQuery({
  args: {
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("zoomCredentials")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
      .first();
  },
});

/**
 * Raw (encrypted) credential by accountId — for use by crypto actions.
 */
export const getRawCredByAccountId = internalQuery({
  args: {
    accountId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("zoomCredentials")
      .filter((q) => q.eq(q.field("accountId"), args.accountId))
      .first();
  },
});

/**
 * Raw first credential record — for challenge-response.
 */
export const getRawFirstCredential = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("zoomCredentials").first();
  },
});

/**
 * Raw (encrypted) credential by tenantId — for use by crypto actions.
 */
export const getRawCredByTenantId = internalQuery({
  args: {
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("zoomCredentials")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
      .unique();
  },
});

// ─── Internal Mutations ────────────────────────────────────────────────────

export const upsertZoomCredentials = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    accountId: v.string(),
    clientId: v.string(),
    clientSecret: v.string(),
    webhookSecretToken: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("zoomCredentials")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accountId: args.accountId,
        clientId: args.clientId,
        clientSecret: args.clientSecret,
        webhookSecretToken: args.webhookSecretToken,
        accessToken: undefined,
        accessTokenExpiresAt: undefined,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("zoomCredentials", {
        tenantId: args.tenantId,
        accountId: args.accountId,
        clientId: args.clientId,
        clientSecret: args.clientSecret,
        webhookSecretToken: args.webhookSecretToken,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const updateZoomToken = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    accessToken: v.string(),
    accessTokenExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("zoomCredentials")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
      .first();

    if (!existing) {
      throw new Error("No Zoom credentials found for this tenant");
    }

    await ctx.db.patch(existing._id, {
      accessToken: args.accessToken,
      accessTokenExpiresAt: args.accessTokenExpiresAt,
      updatedAt: Date.now(),
    });
  },
});
