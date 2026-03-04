import { query } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, requireRole } from "./auth";

export const createInvitation = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    consultantId: v.id("consultants"),
    email: v.string(),
    displayName: v.optional(v.string()),
    clerkInvitationId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("invitations", {
      tenantId: args.tenantId,
      consultantId: args.consultantId,
      email: args.email,
      displayName: args.displayName ?? null,
      clerkInvitationId: args.clerkInvitationId,
      status: "pending",
      sentAt: now,
      acceptedAt: null,
      createdAt: now,
    });
  },
});

export const updateInvitationStatus = internalMutation({
  args: {
    clerkInvitationId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("revoked"),
      v.literal("expired")
    ),
    acceptedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("invitations")
      .withIndex("by_clerkInvitationId", (q) =>
        q.eq("clerkInvitationId", args.clerkInvitationId)
      )
      .unique();

    if (!invitation) {
      throw new Error(
        `Invitation not found for clerkInvitationId: ${args.clerkInvitationId}`
      );
    }

    await ctx.db.patch(invitation._id, {
      status: args.status,
      ...(args.acceptedAt !== undefined ? { acceptedAt: args.acceptedAt } : {}),
    });
  },
});

export const listInvitations = query({
  args: {
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);
    requireRole(auth, "consultant");

    // Verify consultant owns this tenant
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant || tenant.consultantId !== auth.consultantId) {
      return [];
    }

    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_tenantId_status", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    // Sort by sentAt DESC
    invitations.sort((a, b) => b.sentAt - a.sentAt);

    return invitations;
  },
});
