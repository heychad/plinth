import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

export const getConsultant = query({
  args: { consultantId: v.id("consultants") },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    if (auth.role === "consultant") {
      if (auth.consultantId !== args.consultantId) {
        throw new Error("Not authorized");
      }
    } else if (auth.role !== "platform_admin") {
      throw new Error("Not authorized");
    }

    return await ctx.db.get(args.consultantId);
  },
});

export const updateConsultant = mutation({
  args: {
    displayName: v.optional(v.string()),
    businessName: v.optional(v.string()),
    supportEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    if (auth.role !== "consultant") {
      throw new Error("Only consultants can update their profile");
    }

    const consultant = await ctx.db.get(auth.consultantId!);
    if (!consultant) {
      throw new Error("Consultant not found");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.displayName !== undefined) {
      updates.displayName = args.displayName;
    }
    if (args.businessName !== undefined) {
      updates.businessName = args.businessName;
    }
    if (args.supportEmail !== undefined) {
      updates.supportEmail = args.supportEmail;
    }

    await ctx.db.patch(consultant._id, updates);
  },
});
