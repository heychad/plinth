import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

/**
 * getClientDetail — composite query for the client detail page.
 * Auth: consultant must own the tenantId.
 * Returns: tenant, agentConfigs (with template info + run stats), credentials, recentRuns, reports.
 */
export const getClientDetail = query({
  args: {
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    // Auth: must be consultant or platform_admin
    if (auth.role !== "consultant" && auth.role !== "platform_admin") {
      throw new Error("Not authorized");
    }

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    // Consultant must own this tenant
    if (auth.role === "consultant" && tenant.consultantId !== auth.consultantId) {
      throw new Error("AuthorizationError: Tenant not owned by this consultant");
    }

    // Get all agentConfigs for this tenant
    const rawConfigs = await ctx.db
      .query("agentConfigs")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    // Get current month boundaries for run count
    const now = Date.now();
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startOfMonthTs = startOfMonth.getTime();

    // Enrich each agentConfig with template info and run stats
    const agentConfigs = await Promise.all(
      rawConfigs.map(async (config) => {
        const template = await ctx.db.get(config.templateId);

        // Get all runs for this config (need for stats)
        const allRuns = await ctx.db
          .query("agentRuns")
          .withIndex("by_agentConfigId", (q) => q.eq("agentConfigId", config._id))
          .order("desc")
          .collect();

        const lastRunAt = allRuns.length > 0 ? allRuns[0].createdAt : undefined;
        const runCountThisMonth = allRuns.filter((r) => r.createdAt >= startOfMonthTs).length;

        return {
          ...config,
          templateDisplayName: template?.displayName ?? "Unknown Template",
          templateCategory: template?.category ?? null,
          templateVersion: template?.version ?? null,
          integrationSlots: template?.integrationSlots ?? [],
          lastRunAt,
          runCountThisMonth,
        };
      })
    );

    // Get all credentials for this tenant
    const credentials = await ctx.db
      .query("credentials")
      .withIndex("by_tenantId_slotName", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    // Get recent runs (last 20) ordered desc by createdAt
    const allRecentRuns = await ctx.db
      .query("agentRuns")
      .withIndex("by_tenantId_createdAt", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(20);

    // Enrich runs with agent display name
    const recentRuns = await Promise.all(
      allRecentRuns.map(async (run) => {
        const config = rawConfigs.find((c) => c._id === run.agentConfigId);
        return {
          ...run,
          agentDisplayName: config?.displayName ?? "Unknown Agent",
        };
      })
    );

    // Get coaching reports for this tenant (only if any exist)
    const reports = await ctx.db
      .query("coachingCallReports")
      .withIndex("by_tenantId_status", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .collect();

    return {
      tenant,
      agentConfigs,
      credentials,
      recentRuns,
      reports,
    };
  },
});
