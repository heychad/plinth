import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

async function resolveUserId(ctx: { db: any }, clerkUserId: string) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkUserId", (q: any) => q.eq("clerkUserId", clerkUserId))
    .unique();
  if (!user) {
    throw new Error("User record not found");
  }
  return user._id;
}

export const listConversations = query({
  args: {},
  handler: async (ctx) => {
    const auth = await requireAuth(ctx);
    const userId = await resolveUserId(ctx, auth.clerkUserId);

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_userId_lastMessageAt", (q) =>
        q.eq("userId", userId)
      )
      .order("desc")
      .take(20);

    return conversations;
  },
});

export const getConversation = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);
    const userId = await resolveUserId(ctx, auth.clerkUserId);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return null;
    }

    if (conversation.userId !== userId) {
      return null;
    }

    return conversation;
  },
});

export const createConversation = mutation({
  args: {
    agentConfigId: v.optional(v.id("agentConfigs")),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);
    if (!auth.tenantId) {
      throw new Error("No tenant associated with user");
    }
    const userId = await resolveUserId(ctx, auth.clerkUserId);

    const now = Date.now();
    return await ctx.db.insert("conversations", {
      tenantId: auth.tenantId,
      userId,
      agentConfigId: args.agentConfigId ?? null,
      title: "New conversation",
      lastMessageAt: now,
      messageCount: 0,
      platform: "web",
      status: "active",
      createdAt: now,
    });
  },
});
