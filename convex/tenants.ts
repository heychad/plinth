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
