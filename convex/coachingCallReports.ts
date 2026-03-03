import {
  query,
  mutation,
  internalMutation,
} from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Determine if the caller is an admin for the given tenant.
 * Admin = consultant role with ownership of the tenant, or platform_admin.
 */
async function isAdminForTenant(
  ctx: Parameters<typeof requireAuth>[0],
  tenantId: import("./_generated/dataModel").Id<"tenants">,
  auth: Awaited<ReturnType<typeof requireAuth>>
): Promise<boolean> {
  if (auth.role === "platform_admin") {
    return true;
  }
  if (auth.role === "consultant") {
    const tenant = await ctx.db.get(tenantId);
    return !!tenant && tenant.consultantId === auth.consultantId;
  }
  return false;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export const getCoachingReport = query({
  args: {
    reportId: v.id("coachingCallReports"),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      return null;
    }

    const adminAccess = await isAdminForTenant(ctx, report.tenantId, auth);

    if (adminAccess) {
      return report;
    }

    // Coach access: only released reports where coachId matches
    if (auth.role === "client") {
      // Coaches are client-role users; match by Clerk user identity to coachId
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new Error("Not authenticated");
      }
      // coachId is the external coach identifier stored in the report
      // We match the caller's tenantId and allow access only to released reports
      if (auth.tenantId !== report.tenantId) {
        throw new Error("Not authorized");
      }
      if (!report.releasedToCoach || report.coachId !== identity.subject) {
        throw new Error("Not authorized");
      }

      // Omit sensitive fields for coach callers
      const { rawAnalysisJson: _rawAnalysisJson, transcriptStorageId: _transcriptStorageId, ...coachView } = report;
      return coachView;
    }

    throw new Error("Not authorized");
  },
});

export const listCoachingReports = query({
  args: {
    tenantId: v.id("tenants"),
    coachId: v.optional(v.string()),
    status: v.optional(v.string()),
    flagged: v.optional(v.boolean()),
    callNumber: v.optional(v.union(v.number(), v.literal("onboarding"), v.literal("bonus"))),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    const adminAccess = await isAdminForTenant(ctx, args.tenantId, auth);

    if (!adminAccess && auth.role !== "client") {
      throw new Error("Not authorized");
    }

    // For client/coach callers, enforce tenant scope and released-only filter
    if (!adminAccess) {
      if (auth.tenantId !== args.tenantId) {
        throw new Error("Not authorized");
      }
    }

    // Build query using available indexes
    let dbQuery;

    if (args.flagged !== undefined) {
      // Use by_tenantId_flagged index
      dbQuery = ctx.db
        .query("coachingCallReports")
        .withIndex("by_tenantId_flagged", (q) =>
          q.eq("tenantId", args.tenantId).eq("flagged", args.flagged!)
        );
    } else if (args.coachId) {
      // Use by_tenantId_coachId index
      dbQuery = ctx.db
        .query("coachingCallReports")
        .withIndex("by_tenantId_coachId", (q) =>
          q.eq("tenantId", args.tenantId).eq("coachId", args.coachId!)
        );
    } else if (args.status) {
      // Use by_tenantId_status index
      dbQuery = ctx.db
        .query("coachingCallReports")
        .withIndex("by_tenantId_status", (q) =>
          q.eq("tenantId", args.tenantId).eq("status", args.status! as "draft" | "reviewed" | "sent" | "no_action")
        );
    } else {
      // Default: all for tenant, sorted desc by createdAt via status index with full scan
      dbQuery = ctx.db
        .query("coachingCallReports")
        .withIndex("by_tenantId_status", (q) =>
          q.eq("tenantId", args.tenantId)
        );
    }

    // Default sort: flagged+draft first, then createdAt desc
    // Convex doesn't support multi-key sort natively; we collect + sort in memory
    // For paginated results, sort descending (newest first as secondary)
    const result = await dbQuery.order("desc").paginate(args.paginationOpts);

    let reports = result.page;

    // Apply in-memory filters for fields not covered by the selected index
    if (args.callNumber !== undefined) {
      reports = reports.filter((r) => r.callNumber === args.callNumber);
    }

    if (!adminAccess) {
      // Coach: only released reports matching their coachId
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new Error("Not authenticated");
      }
      reports = reports.filter(
        (r) => r.releasedToCoach && r.coachId === identity.subject
      );

      // Strip sensitive fields for coach view
      reports = reports.map((r) => {
        const { rawAnalysisJson: _rawAnalysisJson, transcriptStorageId: _transcriptStorageId, ...coachView } = r;
        return coachView as typeof r;
      });
    }

    // Default sort: flagged draft first, then createdAt desc
    reports = reports.sort((a, b) => {
      const aFlaggedDraft = a.flagged && a.status === "draft" ? 1 : 0;
      const bFlaggedDraft = b.flagged && b.status === "draft" ? 1 : 0;
      if (bFlaggedDraft !== aFlaggedDraft) {
        return bFlaggedDraft - aFlaggedDraft;
      }
      return b.createdAt - a.createdAt;
    });

    return {
      reports,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

export const getCoachScoreTrend = query({
  args: {
    tenantId: v.id("tenants"),
    coachId: v.string(),
    limitDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    const adminAccess = await isAdminForTenant(ctx, args.tenantId, auth);

    if (!adminAccess) {
      // Coach can view only their own data
      if (auth.role !== "client") {
        throw new Error("Not authorized");
      }
      if (auth.tenantId !== args.tenantId) {
        throw new Error("Not authorized");
      }
      const identity = await ctx.auth.getUserIdentity();
      if (!identity || identity.subject !== args.coachId) {
        throw new Error("Not authorized");
      }
    }

    const limitDays = args.limitDays ?? 90;
    const cutoff = Date.now() - limitDays * 24 * 60 * 60 * 1000;

    const reports = await ctx.db
      .query("coachingCallReports")
      .withIndex("by_tenantId_coachId", (q) =>
        q.eq("tenantId", args.tenantId).eq("coachId", args.coachId)
      )
      .order("asc")
      .collect();

    return reports
      .filter((r) => r.createdAt >= cutoff)
      .map((r) => ({
        date: new Date(r.createdAt).toISOString().split("T")[0],
        score: r.overallScore,
        callNumber: String(r.callNumber),
      }));
  },
});

export const getTranscriptUrl = query({
  args: {
    reportId: v.id("coachingCallReports"),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    const adminAccess = await isAdminForTenant(ctx, report.tenantId, auth);
    if (!adminAccess) {
      throw new Error("Not authorized");
    }

    return await ctx.storage.getUrl(report.transcriptStorageId as import("./_generated/dataModel").Id<"_storage">);
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

export const updateReportNarrative = mutation({
  args: {
    reportId: v.id("coachingCallReports"),
    editedNarrative: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    const adminAccess = await isAdminForTenant(ctx, report.tenantId, auth);
    if (!adminAccess) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(args.reportId, {
      editedNarrative: args.editedNarrative,
      status: "reviewed",
      updatedAt: Date.now(),
    });
  },
});

export const sendReportToCoach = mutation({
  args: {
    reportId: v.id("coachingCallReports"),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    const adminAccess = await isAdminForTenant(ctx, report.tenantId, auth);
    if (!adminAccess) {
      throw new Error("Not authorized");
    }

    if (report.status === "sent") {
      throw new Error("Report has already been sent to the coach");
    }

    const now = Date.now();
    await ctx.db.patch(args.reportId, {
      releasedToCoach: true,
      status: "sent",
      sentAt: now,
      updatedAt: now,
    });
  },
});

export const markNoAction = mutation({
  args: {
    reportId: v.id("coachingCallReports"),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    const adminAccess = await isAdminForTenant(ctx, report.tenantId, auth);
    if (!adminAccess) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(args.reportId, {
      status: "no_action",
      updatedAt: Date.now(),
    });
  },
});

// ─── Internal Mutations (pipeline use) ───────────────────────────────────────

export const createReport = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    agentRunId: v.id("agentRuns"),
    coachId: v.string(),
    coachName: v.optional(v.string()),
    studentId: v.optional(v.string()),
    studentName: v.optional(v.string()),
    callNumber: v.union(v.number(), v.literal("onboarding"), v.literal("bonus")),
    zoomMeetingId: v.optional(v.string()),
    recordedAt: v.optional(v.number()),
    durationMinutes: v.optional(v.number()),
    transcriptStorageId: v.string(),
    parsedTranscript: v.optional(v.string()),
    overallScore: v.number(),
    dimensionScores: v.any(),
    highlights: v.array(v.string()),
    concerns: v.array(v.string()),
    narrative: v.string(),
    coachTalkPercent: v.optional(v.number()),
    flagged: v.boolean(),
    rawAnalysisJson: v.any(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("coachingCallReports", {
      ...args,
      status: "draft",
      releasedToCoach: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateReport = internalMutation({
  args: {
    reportId: v.id("coachingCallReports"),
    overallScore: v.optional(v.number()),
    dimensionScores: v.optional(v.any()),
    highlights: v.optional(v.array(v.string())),
    concerns: v.optional(v.array(v.string())),
    narrative: v.optional(v.string()),
    coachTalkPercent: v.optional(v.number()),
    flagged: v.optional(v.boolean()),
    rawAnalysisJson: v.optional(v.any()),
    parsedTranscript: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("reviewed"),
        v.literal("sent"),
        v.literal("no_action")
      )
    ),
  },
  handler: async (ctx, args) => {
    const { reportId, ...fields } = args;

    const report = await ctx.db.get(reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    // Build patch with only provided fields
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }

    await ctx.db.patch(reportId, patch);
  },
});
