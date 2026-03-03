"use node";

import { action, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Composio } from "composio-core";

/**
 * Initiates a Composio OAuth flow for a tenant's integration slot.
 * Returns the Composio-generated auth URL for the client to visit.
 *
 * Auth: tenant user (client connecting their own integration) or consultant who owns the tenant.
 */
export const initiateComposioOAuth = action({
  args: {
    tenantId: v.id("tenants"),
    slotName: v.string(),
    provider: v.string(),
    redirectUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ authUrl: string }> => {
    // Auth check via query (actions cannot use ctx.db directly)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const authInfo = await ctx.runQuery(
      (internal as any).integrations.composio.getAuthInfoForAction,
      { clerkUserId: identity.subject, tenantId: args.tenantId }
    );

    if (!authInfo.authorized) {
      throw new Error("Not authorized");
    }

    const apiKey = process.env.COMPOSIO_API_KEY;
    if (!apiKey) {
      throw new Error("COMPOSIO_API_KEY is not configured");
    }

    // Entity ID format: plinth_tenant_{tenantId}
    const entityId = `plinth_tenant_${args.tenantId}`;

    // Create/update credential record with status "pending" before initiating OAuth
    await ctx.runMutation((internal as any).credentials.upsertCredential, {
      tenantId: args.tenantId,
      slotName: args.slotName,
      provider: args.provider,
      status: "pending",
    });

    // Initialize Composio client and get entity
    const composio = new Composio({ apiKey });
    const entity = composio.getEntity(entityId);

    // Initiate OAuth connection
    const connectionRequest = await entity.initiateConnection({
      appName: args.provider,
      redirectUri: args.redirectUrl,
    });

    if (!connectionRequest.redirectUrl) {
      throw new Error("Composio did not return an auth URL");
    }

    return { authUrl: connectionRequest.redirectUrl };
  },
});

/**
 * Internal query to resolve auth context for the initiateComposioOAuth action.
 * Checks whether the caller (identified by clerkUserId) has access to the given tenant.
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
