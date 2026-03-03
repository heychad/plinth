import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";
import { Id } from "./_generated/dataModel";

// Returns aggregate stats for the calling consultant's dashboard header.
export const getConsultantDashboard = query({
  args: {},
  handler: async (ctx) => {
    const auth = await requireAuth(ctx);

    if (auth.role !== "consultant" && auth.role !== "platform_admin") {
      throw new Error("Not authorized");
    }

    const consultantId = auth.consultantId!;

    // Get all tenants for this consultant
    const tenants = await ctx.db
      .query("tenants")
      .withIndex("by_consultantId", (q) => q.eq("consultantId", consultantId))
      .collect();

    // Count active tenants
    const activeClientCount = tenants.filter((t) => t.status === "active").length;

    // Count deployed agentConfigs across all tenants
    let totalAgentsDeployed = 0;
    for (const tenant of tenants) {
      const configs = await ctx.db
        .query("agentConfigs")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", tenant._id))
        .collect();
      totalAgentsDeployed += configs.length;
    }

    // Count flagged draft reports across all tenants
    let flaggedReportCount = 0;
    for (const tenant of tenants) {
      const flaggedReports = await ctx.db
        .query("coachingCallReports")
        .withIndex("by_tenantId_flagged", (q) =>
          q.eq("tenantId", tenant._id).eq("flagged", true)
        )
        .collect();
      flaggedReportCount += flaggedReports.filter((r) => r.status === "draft").length;
    }

    // Sum monthly cost from usageLogs for current month using by_consultantId index
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const usageLogs = await ctx.db
      .query("usageLogs")
      .withIndex("by_consultantId", (q) => q.eq("consultantId", consultantId))
      .collect();

    const monthlyCostUsd = usageLogs
      .filter((log) => log.loggedDate.startsWith(monthPrefix))
      .reduce((sum, log) => sum + log.costUsd, 0);

    return {
      activeClientCount,
      totalAgentsDeployed,
      flaggedReportCount,
      monthlyCostUsd,
    };
  },
});

export type TenantSummary = {
  tenantId: Id<"tenants">;
  businessName: string;
  ownerName: string;
  status: "active" | "paused" | "churned";
  deployedAgentCount: number;
  lastRunAt: number | null;
  monthlyUsageCost: number;
};

// Returns enriched tenant list for the consultant's client roster.
// Supports search, status filter, and sort. Uses collect() for in-memory
// aggregation since consultants typically have <100 tenants.
export const listClientsForConsultant = query({
  args: {
    search: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("active"), v.literal("paused"), v.literal("churned"))
    ),
    sortBy: v.optional(
      v.union(
        v.literal("businessName"),
        v.literal("lastRun"),
        v.literal("monthlyCost")
      )
    ),
    sortDir: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    if (auth.role !== "consultant" && auth.role !== "platform_admin") {
      throw new Error("Not authorized");
    }

    const consultantId = auth.consultantId!;

    // Get all tenants for this consultant
    const tenants = await ctx.db
      .query("tenants")
      .withIndex("by_consultantId", (q) => q.eq("consultantId", consultantId))
      .collect();

    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Enrich each tenant with computed fields
    const enriched: TenantSummary[] = await Promise.all(
      tenants.map(async (tenant) => {
        // Count deployed agent configs
        const configs = await ctx.db
          .query("agentConfigs")
          .withIndex("by_tenantId", (q) => q.eq("tenantId", tenant._id))
          .collect();
        const deployedAgentCount = configs.length;

        // Most recent run
        const latestRun = await ctx.db
          .query("agentRuns")
          .withIndex("by_tenantId_createdAt", (q) =>
            q.eq("tenantId", tenant._id)
          )
          .order("desc")
          .first();
        const lastRunAt = latestRun?.createdAt ?? null;

        // Monthly usage cost
        const usageLogs = await ctx.db
          .query("usageLogs")
          .withIndex("by_tenantId_loggedDate", (q) =>
            q
              .eq("tenantId", tenant._id)
              .gte("loggedDate", monthPrefix)
              .lt("loggedDate", monthPrefix + "~")
          )
          .collect();
        const monthlyUsageCost = usageLogs.reduce(
          (sum, log) => sum + log.costUsd,
          0
        );

        return {
          tenantId: tenant._id,
          businessName: tenant.businessName,
          ownerName: tenant.ownerName,
          status: tenant.status,
          deployedAgentCount,
          lastRunAt,
          monthlyUsageCost,
        };
      })
    );

    // Apply search filter
    let filtered = enriched;
    if (args.search && args.search.trim() !== "") {
      const searchLower = args.search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.businessName.toLowerCase().includes(searchLower) ||
          t.ownerName.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (args.status) {
      filtered = filtered.filter((t) => t.status === args.status);
    }

    // Apply sort (default: businessName asc)
    const sortBy = args.sortBy ?? "businessName";
    const sortDir = args.sortDir ?? "asc";
    const direction = sortDir === "asc" ? 1 : -1;

    filtered.sort((a, b) => {
      if (sortBy === "businessName") {
        return direction * a.businessName.localeCompare(b.businessName);
      }
      if (sortBy === "lastRun") {
        const aVal = a.lastRunAt ?? 0;
        const bVal = b.lastRunAt ?? 0;
        return direction * (aVal - bVal);
      }
      if (sortBy === "monthlyCost") {
        return direction * (a.monthlyUsageCost - b.monthlyUsageCost);
      }
      return 0;
    });

    // Manual pagination using cursor (cursor is string index into sorted array)
    const limit = args.limit ?? 50;
    const startIndex = args.cursor ? parseInt(args.cursor, 10) : 0;
    const page = filtered.slice(startIndex, startIndex + limit);
    const nextIndex = startIndex + limit;
    const nextCursor =
      nextIndex < filtered.length ? String(nextIndex) : null;

    return {
      tenants: page,
      nextCursor,
    };
  },
});
