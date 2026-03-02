"use node";

import { httpAction, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

/**
 * GET /oauth/composio/callback
 *
 * Receives the Composio OAuth callback after a user completes OAuth.
 * Query params from Composio: entityId, connectionId
 * Query params passed through from our redirectUrl: slotName, provider
 *
 * On success: updates credential to status="active", redirects to integrations page.
 * On error: updates credential to status="error", redirects with error state.
 */
export const composioCallback = httpAction(async (ctx, request) => {
  const url = new URL(request.url);

  // Composio passes these back
  const entityId = url.searchParams.get("entityId");
  const connectionId = url.searchParams.get("connectionId");

  // We embed these in our redirectUrl when initiating OAuth
  const slotName = url.searchParams.get("slotName");
  const provider = url.searchParams.get("provider") ?? "";

  // Error params from Composio
  const errorParam = url.searchParams.get("error");
  const errorDescription =
    url.searchParams.get("error_description") ?? errorParam ?? "OAuth connection failed";

  // Base redirect URL — client portal integrations page
  const portalUrl = process.env.CLIENT_PORTAL_URL ?? "https://app.onplinth.ai";
  const integrationsPageUrl = `${portalUrl}/app/integrations`;

  // ── Error callback ────────────────────────────────────────────────────────

  if (errorParam) {
    if (entityId && slotName) {
      const tenantId = entityId.replace("plinth_tenant_", "") as Id<"tenants">;
      try {
        await ctx.runMutation(
          internal.webhooks.composioCallback.setCredentialStatus,
          {
            tenantId,
            slotName,
            provider,
            status: "error",
            errorMessage: errorDescription,
          }
        );
      } catch {
        // Best effort — always redirect
      }
    }

    const redirect = new URL(integrationsPageUrl);
    redirect.searchParams.set("oauth_error", "true");
    redirect.searchParams.set("error_description", errorDescription);

    return new Response(null, {
      status: 302,
      headers: { Location: redirect.toString() },
    });
  }

  // ── Success callback ──────────────────────────────────────────────────────

  if (!entityId || !connectionId) {
    const redirect = new URL(integrationsPageUrl);
    redirect.searchParams.set("oauth_error", "true");
    redirect.searchParams.set("error_description", "Missing required callback parameters");
    return new Response(null, {
      status: 302,
      headers: { Location: redirect.toString() },
    });
  }

  if (!slotName) {
    const redirect = new URL(integrationsPageUrl);
    redirect.searchParams.set("oauth_error", "true");
    redirect.searchParams.set("error_description", "Missing slotName in callback");
    return new Response(null, {
      status: 302,
      headers: { Location: redirect.toString() },
    });
  }

  // Extract tenantId from entityId (format: plinth_tenant_{tenantId})
  const tenantId = entityId.replace("plinth_tenant_", "") as Id<"tenants">;

  try {
    await ctx.runMutation(
      internal.webhooks.composioCallback.setCredentialStatus,
      {
        tenantId,
        slotName,
        provider,
        composioEntityId: entityId,
        status: "active",
        connectedAt: Date.now(),
      }
    );
  } catch {
    const redirect = new URL(integrationsPageUrl);
    redirect.searchParams.set("oauth_error", "true");
    redirect.searchParams.set("error_description", "Failed to save credential");
    return new Response(null, {
      status: 302,
      headers: { Location: redirect.toString() },
    });
  }

  // Redirect to integrations page with success state
  const redirect = new URL(integrationsPageUrl);
  redirect.searchParams.set("oauth_success", "true");
  redirect.searchParams.set("slot", slotName);

  return new Response(null, {
    status: 302,
    headers: { Location: redirect.toString() },
  });
});

/**
 * Internal mutation: create or update a credential record from an OAuth callback.
 * Used exclusively by composioCallback httpAction.
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
