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

export const listMessages = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);
    const userId = await resolveUserId(ctx, auth.clerkUserId);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      return null;
    }

    return await ctx.db
      .query("messages")
      .withIndex("by_conversationId_createdAt", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();
  },
});

export const createUserMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);
    if (!auth.tenantId) {
      throw new Error("No tenant associated with user");
    }
    const userId = await resolveUserId(ctx, auth.clerkUserId);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found or access denied");
    }

    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      tenantId: auth.tenantId,
      role: "user",
      content: args.content,
      streamingToken: null,
      isStreaming: false,
      agentConfigId: null,
      agentRunId: null,
      createdAt: now,
    });

    // Update conversation lastMessageAt and messageCount
    await ctx.db.patch(conversation._id, {
      lastMessageAt: now,
      messageCount: conversation.messageCount + 1,
      title:
        conversation.messageCount === 0
          ? args.content.slice(0, 60)
          : conversation.title,
    });

    return messageId;
  },
});
