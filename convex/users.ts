import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

export const createUser = mutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    displayName: v.string(),
    role: v.union(
      v.literal("client"),
      v.literal("consultant"),
      v.literal("platform_admin")
    ),
    tenantId: v.optional(v.id("tenants")),
    consultantId: v.optional(v.id("consultants")),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    if (auth.role !== "platform_admin") {
      throw new Error("Not authorized");
    }

    if (args.role === "client") {
      if (!args.tenantId || args.consultantId != null) {
        throw new Error("Client users must have tenantId set");
      }
    } else if (args.role === "consultant") {
      if (!args.consultantId || args.tenantId != null) {
        throw new Error("Consultant users must have consultantId set");
      }
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) =>
        q.eq("clerkUserId", args.clerkUserId)
      )
      .first();

    if (existing) {
      throw new Error("User with this clerkUserId already exists");
    }

    return await ctx.db.insert("users", {
      clerkUserId: args.clerkUserId,
      email: args.email,
      displayName: args.displayName,
      role: args.role,
      tenantId: args.tenantId,
      consultantId: args.consultantId,
      createdAt: Date.now(),
    });
  },
});
