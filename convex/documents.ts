import { query, mutation, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
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

export const listDocuments = query({
  args: {
    sortBy: v.optional(
      v.union(
        v.literal("createdAt"),
        v.literal("updatedAt"),
        v.literal("title")
      )
    ),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);
    if (!auth.tenantId) {
      throw new Error("No tenant associated with user");
    }

    const sortBy = args.sortBy ?? "createdAt";

    if (sortBy === "title") {
      // Title sort requires full scan — no index on title
      const docs = await ctx.db
        .query("documents")
        .withIndex("by_tenantId_createdAt", (q) =>
          q.eq("tenantId", auth.tenantId!)
        )
        .collect();
      docs.sort((a, b) => a.title.localeCompare(b.title));
      return docs.slice(0, 50);
    }

    if (sortBy === "updatedAt") {
      // No index on updatedAt — collect and sort in memory
      const docs = await ctx.db
        .query("documents")
        .withIndex("by_tenantId_createdAt", (q) =>
          q.eq("tenantId", auth.tenantId!)
        )
        .collect();
      docs.sort((a, b) => b.updatedAt - a.updatedAt);
      return docs.slice(0, 50);
    }

    // Default: createdAt DESC via index
    return await ctx.db
      .query("documents")
      .withIndex("by_tenantId_createdAt", (q) =>
        q.eq("tenantId", auth.tenantId!)
      )
      .order("desc")
      .take(50);
  },
});

export const getDocument = query({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);
    if (!auth.tenantId) {
      return null;
    }

    const doc = await ctx.db.get(args.documentId);
    if (!doc) {
      return null;
    }

    if (doc.tenantId !== auth.tenantId) {
      return null;
    }

    // If storageId is set, generate a signed URL for content retrieval
    if (doc.storageId) {
      const url = await ctx.storage.getUrl(doc.storageId);
      return { ...doc, contentUrl: url };
    }

    return doc;
  },
});

export const createDocument = mutation({
  args: {
    title: v.string(),
    content: v.optional(v.string()),
    source: v.optional(v.union(v.literal("user"), v.literal("agent"))),
    agentRunId: v.optional(v.id("agentRuns")),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);
    if (!auth.tenantId) {
      throw new Error("No tenant associated with user");
    }
    const userId = await resolveUserId(ctx, auth.clerkUserId);

    const now = Date.now();
    return await ctx.db.insert("documents", {
      tenantId: auth.tenantId,
      userId,
      title: args.title,
      content: args.content ?? null,
      storageId: null,
      mimeType: "text/markdown",
      source: args.source ?? "user",
      agentRunId: args.agentRunId ?? null,
      agentConfigId: null,
      googleDocUrl: null,
      wordCount: args.content ? args.content.split(/\s+/).filter(Boolean).length : null,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateDocument = mutation({
  args: {
    documentId: v.id("documents"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);
    if (!auth.tenantId) {
      throw new ConvexError("No tenant associated with user");
    }

    const doc = await ctx.db.get(args.documentId);
    if (!doc) {
      throw new ConvexError("Document not found");
    }

    if (doc.tenantId !== auth.tenantId) {
      throw new ConvexError("Access denied: document belongs to another tenant");
    }

    const patch: Record<string, any> = {
      updatedAt: Date.now(),
    };

    if (args.title !== undefined) {
      patch.title = args.title;
    }

    if (args.content !== undefined) {
      patch.content = args.content;
      patch.wordCount = args.content.split(/\s+/).filter(Boolean).length;
    }

    await ctx.db.patch(args.documentId, patch);
  },
});

export const saveAgentDocument = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    agentRunId: v.id("agentRuns"),
    agentConfigId: v.optional(v.id("agentConfigs")),
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Idempotent: check for existing document with same agentRunId
    const existing = await ctx.db
      .query("documents")
      .withIndex("by_agentRunId", (q) => q.eq("agentRunId", args.agentRunId))
      .unique();

    const now = Date.now();
    const wordCount = args.content.split(/\s+/).filter(Boolean).length;

    if (existing) {
      // Upsert: update existing document
      await ctx.db.patch(existing._id, {
        title: args.title,
        content: args.content,
        wordCount,
        updatedAt: now,
      });
      return existing._id;
    }

    // Look up a userId for the tenant (use first user found)
    const tenantUser = await ctx.db
      .query("users")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
      .first();

    if (!tenantUser) {
      throw new Error("No user found for tenant");
    }

    return await ctx.db.insert("documents", {
      tenantId: args.tenantId,
      userId: tenantUser._id,
      title: args.title,
      content: args.content,
      storageId: null,
      mimeType: "text/markdown",
      source: "agent",
      agentRunId: args.agentRunId,
      agentConfigId: args.agentConfigId ?? null,
      googleDocUrl: null,
      wordCount,
      createdAt: now,
      updatedAt: now,
    });
  },
});
