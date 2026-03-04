import { query, mutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

export const listTenants = query({
  args: {
    consultantId: v.optional(v.id("consultants")),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    if (auth.role === "client") {
      throw new Error("Not authorized");
    }

    if (auth.role === "consultant") {
      return await ctx.db
        .query("tenants")
        .withIndex("by_consultantId", (q) =>
          q.eq("consultantId", auth.consultantId!)
        )
        .paginate(args.paginationOpts);
    }

    // platform_admin
    if (args.consultantId) {
      return await ctx.db
        .query("tenants")
        .withIndex("by_consultantId", (q) =>
          q.eq("consultantId", args.consultantId!)
        )
        .paginate(args.paginationOpts);
    }

    return await ctx.db.query("tenants").paginate(args.paginationOpts);
  },
});

export const createTenant = mutation({
  args: {
    businessName: v.string(),
    ownerName: v.string(),
    ownerEmail: v.string(),
    vertical: v.optional(
      v.union(
        v.literal("spa"),
        v.literal("course"),
        v.literal("speaker"),
        v.literal("consultant"),
        v.literal("other")
      )
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    if (auth.role !== "consultant") {
      throw new Error("Not authorized");
    }

    const consultantId = auth.consultantId!;

    const existing = await ctx.db
      .query("tenants")
      .withIndex("by_consultantId_ownerEmail", (q) =>
        q.eq("consultantId", consultantId).eq("ownerEmail", args.ownerEmail)
      )
      .first();

    if (existing) {
      throw new Error("Tenant with this email already exists for this consultant");
    }

    const now = Date.now();
    return await ctx.db.insert("tenants", {
      consultantId,
      businessName: args.businessName,
      ownerName: args.ownerName,
      ownerEmail: args.ownerEmail,
      vertical: args.vertical,
      notes: args.notes,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateTenant = mutation({
  args: {
    tenantId: v.id("tenants"),
    businessName: v.optional(v.string()),
    ownerName: v.optional(v.string()),
    ownerEmail: v.optional(v.string()),
    website: v.optional(v.string()),
    vertical: v.optional(
      v.union(
        v.literal("spa"),
        v.literal("course"),
        v.literal("speaker"),
        v.literal("consultant"),
        v.literal("other")
      )
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    if (auth.role !== "consultant" && auth.role !== "platform_admin") {
      throw new Error("Not authorized");
    }

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    // Validate consultant ownership
    if (auth.role === "consultant" && tenant.consultantId !== auth.consultantId) {
      throw new Error("Not authorized");
    }

    const { tenantId: _tenantId, website, ...rest } = args;
    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    if (rest.businessName !== undefined) updates.businessName = rest.businessName;
    if (rest.ownerName !== undefined) updates.ownerName = rest.ownerName;
    if (rest.ownerEmail !== undefined) updates.ownerEmail = rest.ownerEmail;
    if (website !== undefined) updates.websiteUrl = website;
    if (rest.vertical !== undefined) updates.vertical = rest.vertical;
    if (rest.notes !== undefined) updates.notes = rest.notes;

    await ctx.db.patch(args.tenantId, updates);
  },
});
