import { query } from "./_generated/server";
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
