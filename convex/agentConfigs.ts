import { query, mutation, internalQuery } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

export const getAgentConfig = query({
  args: {
    agentConfigId: v.id("agentConfigs"),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    const config = await ctx.db.get(args.agentConfigId);
    if (!config) {
      return null;
    }

    // Auth: tenant user who owns this config, consultant who owns the tenant, or platform_admin
    if (auth.role === "client") {
      if (auth.tenantId !== config.tenantId) {
        throw new Error("Not authorized");
      }
    } else if (auth.role === "consultant") {
      const tenant = await ctx.db.get(config.tenantId);
      if (!tenant || tenant.consultantId !== auth.consultantId) {
        throw new Error("Not authorized");
      }
    }
    // platform_admin has no restrictions

    return config;
  },
});

export const listAgentConfigsForTenant = query({
  args: {
    tenantId: v.id("tenants"),
    status: v.optional(
      v.union(
        v.literal("building"),
        v.literal("testing"),
        v.literal("deployed"),
        v.literal("paused"),
        v.literal("archived")
      )
    ),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    // Auth: tenant users see own tenantId; consultants see their tenants
    if (auth.role === "client") {
      if (auth.tenantId !== args.tenantId) {
        throw new Error("Not authorized");
      }
    } else if (auth.role === "consultant") {
      const tenant = await ctx.db.get(args.tenantId);
      if (!tenant || tenant.consultantId !== auth.consultantId) {
        throw new Error("Not authorized");
      }
    }
    // platform_admin has no restrictions

    if (args.status) {
      const statusFilter = args.status;
      return await ctx.db
        .query("agentConfigs")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
        .filter((q) => q.eq(q.field("status"), statusFilter))
        .paginate(args.paginationOpts);
    }

    return await ctx.db
      .query("agentConfigs")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
      .paginate(args.paginationOpts);
  },
});

export const deployAgentConfig = mutation({
  args: {
    tenantId: v.id("tenants"),
    templateId: v.id("agentTemplates"),
    displayName: v.optional(v.string()),
    lockedFields: v.optional(v.array(v.string())),
    customizableFields: v.optional(v.array(v.string())),
    initialConfig: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    // Auth: must be consultant who owns the tenant
    if (auth.role !== "consultant") {
      throw new Error("Only consultants can deploy agent configs");
    }
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant || tenant.consultantId !== auth.consultantId) {
      throw new Error("Not authorized");
    }

    // Validate template exists and is active
    const template = await ctx.db.get(args.templateId);
    if (!template) {
      throw new Error("Agent template not found");
    }
    if (!template.isActive) {
      throw new Error("Agent template is not active");
    }

    // Enforce one-per-template-per-tenant constraint
    const existing = await ctx.db
      .query("agentConfigs")
      .withIndex("by_tenantId_templateId", (q) =>
        q.eq("tenantId", args.tenantId).eq("templateId", args.templateId)
      )
      .unique();

    if (existing) {
      throw new Error(
        "An agent config already exists for this template and tenant"
      );
    }

    // Merge template defaultConfig with initialConfig (initialConfig wins on collision)
    const defaultConfig =
      template.defaultConfig &&
      typeof template.defaultConfig === "object" &&
      !Array.isArray(template.defaultConfig)
        ? template.defaultConfig
        : {};
    const overrideConfig =
      args.initialConfig &&
      typeof args.initialConfig === "object" &&
      !Array.isArray(args.initialConfig)
        ? args.initialConfig
        : {};
    const mergedConfig = { ...defaultConfig, ...overrideConfig };

    // Use template defaults for locked/customizable fields unless overridden
    const lockedFields =
      args.lockedFields !== undefined
        ? args.lockedFields
        : template.defaultLockedFields;
    const customizableFields =
      args.customizableFields !== undefined
        ? args.customizableFields
        : template.defaultCustomizableFields;

    const now = Date.now();
    const configId = await ctx.db.insert("agentConfigs", {
      tenantId: args.tenantId,
      templateId: args.templateId,
      displayName: args.displayName ?? template.displayName,
      status: "building",
      config: mergedConfig,
      lockedFields,
      customizableFields,
      modelOverride: undefined,
      scheduleCron: undefined,
      scheduleTimezone: "UTC",
      deployedAt: undefined,
      deployedBy: undefined,
      version: 1,
      updatedByType: "admin",
      createdAt: now,
      updatedAt: now,
    });

    return configId;
  },
});

export const updateAgentConfig = mutation({
  args: {
    agentConfigId: v.id("agentConfigs"),
    config: v.optional(v.any()),
    displayName: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("building"),
        v.literal("testing"),
        v.literal("deployed"),
        v.literal("paused"),
        v.literal("archived")
      )
    ),
    lockedFields: v.optional(v.array(v.string())),
    customizableFields: v.optional(v.array(v.string())),
    modelOverride: v.optional(v.string()),
    scheduleCron: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    const config = await ctx.db.get(args.agentConfigId);
    if (!config) {
      throw new Error("Agent config not found");
    }

    // Auth checks
    if (auth.role === "client") {
      if (auth.tenantId !== config.tenantId) {
        throw new Error("Not authorized");
      }
    } else if (auth.role === "consultant") {
      const tenant = await ctx.db.get(config.tenantId);
      if (!tenant || tenant.consultantId !== auth.consultantId) {
        throw new Error("Not authorized");
      }
    }
    // platform_admin has no restrictions

    // Determine updated by type
    let updatedByType: "admin" | "client" | "template_sync";
    if (auth.role === "client") {
      updatedByType = "client";
    } else {
      updatedByType = "admin";
    }

    // For client callers: validate they only update customizableFields
    if (auth.role === "client" && args.config) {
      const requestedFields = Object.keys(
        args.config as Record<string, unknown>
      );
      const lockedSet = new Set(config.lockedFields);
      const lockedViolations = requestedFields.filter((f) => lockedSet.has(f));

      if (lockedViolations.length > 0) {
        throw new Error(
          JSON.stringify({
            code: "LOCKED_FIELD",
            fields: lockedViolations,
            message: `Cannot update locked fields: ${lockedViolations.join(", ")}`,
          })
        );
      }

      // Also enforce that clients can only write to customizableFields
      const customizableSet = new Set(config.customizableFields);
      const nonCustomizable = requestedFields.filter(
        (f) => !customizableSet.has(f)
      );
      if (nonCustomizable.length > 0) {
        throw new Error(
          `Clients can only update customizable fields. Not customizable: ${nonCustomizable.join(", ")}`
        );
      }

      // Clients cannot change structural fields
      if (
        args.displayName !== undefined ||
        args.status !== undefined ||
        args.lockedFields !== undefined ||
        args.customizableFields !== undefined ||
        args.modelOverride !== undefined ||
        args.scheduleCron !== undefined
      ) {
        throw new Error(
          "Clients can only update config field values, not structural settings"
        );
      }
    }

    // Write history record before updating
    const now = Date.now();
    await ctx.db.insert("agentConfigHistory", {
      agentConfigId: args.agentConfigId,
      tenantId: config.tenantId,
      changedByUserId: undefined,
      changedByType: updatedByType,
      previousConfig: config.config,
      newConfig:
        args.config !== undefined
          ? { ...(config.config as Record<string, unknown>), ...args.config }
          : config.config,
      changeSummary: undefined,
      createdAt: now,
    });

    // Build the patch object
    const patch: Record<string, unknown> = {
      version: config.version + 1,
      updatedByType,
      updatedAt: now,
    };

    if (args.config !== undefined) {
      // Merge new config values into existing config
      patch.config = {
        ...(config.config as Record<string, unknown>),
        ...args.config,
      };
    }
    if (args.displayName !== undefined) {
      patch.displayName = args.displayName;
    }
    if (args.status !== undefined) {
      patch.status = args.status;
      if (args.status === "deployed") {
        patch.deployedAt = now;
        // Look up the caller's user record
        const identity = await ctx.auth.getUserIdentity();
        if (identity) {
          const callerUser = await ctx.db
            .query("users")
            .withIndex("by_clerkUserId", (q) =>
              q.eq("clerkUserId", identity.subject)
            )
            .unique();
          if (callerUser) {
            patch.deployedBy = callerUser._id;
          }
        }
      }
    }
    if (args.lockedFields !== undefined) {
      patch.lockedFields = args.lockedFields;
    }
    if (args.customizableFields !== undefined) {
      patch.customizableFields = args.customizableFields;
    }
    if (args.modelOverride !== undefined) {
      patch.modelOverride = args.modelOverride;
    }
    if (args.scheduleCron !== undefined) {
      patch.scheduleCron = args.scheduleCron;
    }

    await ctx.db.patch(args.agentConfigId, patch);
  },
});

export const getAgentConfigForClient = query({
  args: {
    agentConfigId: v.id("agentConfigs"),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    // Auth: caller must be a client user in the tenant that owns this agentConfigId
    if (auth.role !== "client") {
      throw new Error("Only client users can use getAgentConfigForClient");
    }

    const config = await ctx.db.get(args.agentConfigId);
    if (!config) {
      return null;
    }

    if (auth.tenantId !== config.tenantId) {
      throw new Error("Not authorized");
    }

    const template = await ctx.db.get(config.templateId);
    if (!template) {
      throw new Error("Agent template not found");
    }

    // Build config object with only customizableFields values (strip locked field values)
    const customizableSet = new Set(config.customizableFields);
    const rawConfig = (config.config as Record<string, unknown>) ?? {};
    const clientConfig: Record<string, unknown> = {};
    for (const key of Object.keys(rawConfig)) {
      if (customizableSet.has(key)) {
        clientConfig[key] = rawConfig[key];
      }
    }

    // Build integrationSlots with credential status
    const integrationSlots: Array<{
      slotName: string;
      connected: boolean;
      connectedAt?: number;
    }> = [];
    for (const slotName of template.integrationSlots) {
      const credential = await ctx.db
        .query("credentials")
        .withIndex("by_tenantId_slotName", (q) =>
          q.eq("tenantId", config.tenantId).eq("slotName", slotName)
        )
        .unique();

      integrationSlots.push({
        slotName,
        connected: credential?.status === "active",
        connectedAt: credential?.connectedAt,
      });
    }

    return {
      displayName: config.displayName,
      status: config.status,
      template: {
        displayName: template.displayName,
        description: template.description,
        inputSchema: template.inputSchema,
      },
      config: clientConfig,
      customizableFields: config.customizableFields,
      integrationSlots,
    };
  },
});

// Internal query used by the execution engine to fetch the raw agentConfig + templateSlug
export const getConfigById = internalQuery({
  args: {
    agentConfigId: v.id("agentConfigs"),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db.get(args.agentConfigId);
    if (!config) return null;
    const template = await ctx.db.get(config.templateId);
    return {
      ...config,
      templateSlug: template?.slug ?? "unknown",
    };
  },
});

// Query for the client home page — returns agent config summaries + run stats for the caller's tenant
export const getClientHome = query({
  args: {},
  handler: async (ctx) => {
    const auth = await requireAuth(ctx);

    if (auth.role !== "client") {
      throw new Error("Only client users can use getClientHome");
    }

    const tenantId = auth.tenantId!;

    // Load all agent configs for this tenant
    const configs = await ctx.db
      .query("agentConfigs")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", tenantId))
      .collect();

    // Determine the start of the current calendar month (UTC)
    const now = Date.now();
    const nowDate = new Date(now);
    const monthStart = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), 1);

    // Build summaries — one query per config for lastRunAt and monthly run count
    const agentConfigs = await Promise.all(
      configs.map(async (config) => {
        // Most recent run for this config
        const latestRun = await ctx.db
          .query("agentRuns")
          .withIndex("by_agentConfigId", (q) => q.eq("agentConfigId", config._id))
          .order("desc")
          .first();

        // Count runs created in the current month
        const allRuns = await ctx.db
          .query("agentRuns")
          .withIndex("by_agentConfigId", (q) => q.eq("agentConfigId", config._id))
          .collect();
        const monthlyRunCount = allRuns.filter((r) => r.createdAt >= monthStart).length;

        // Join with template for displayName
        const template = await ctx.db.get(config.templateId);

        return {
          configId: config._id,
          displayName: config.displayName,
          status: config.status,
          templateDisplayName: template?.displayName ?? "Unknown Template",
          lastRunAt: latestRun?.createdAt,
          monthlyRunCount,
        };
      })
    );

    // Compute overall stats: total runs this month and the most recent run across all configs
    const totalRunCount = agentConfigs.reduce((sum, c) => sum + c.monthlyRunCount, 0);

    // Find the most recent run across all configs
    const mostRecentRun = await ctx.db
      .query("agentRuns")
      .withIndex("by_tenantId_createdAt", (q) => q.eq("tenantId", tenantId))
      .order("desc")
      .first();

    // Get the agent config display name for the most recent run
    let lastRunAgentName: string | undefined;
    if (mostRecentRun) {
      const runConfig = configs.find(
        (c) => c._id === mostRecentRun.agentConfigId
      );
      lastRunAgentName = runConfig?.displayName;
    }

    return {
      agentConfigs,
      runCount: totalRunCount,
      lastRunAt: mostRecentRun?.createdAt,
      lastRunAgentName,
    };
  },
});

// Internal query used by the execution engine (Items 9/10)
// Returns merged config for execution: merges template defaultConfig with tenant config
export const getResolved = internalQuery({
  args: {
    agentConfigId: v.id("agentConfigs"),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db.get(args.agentConfigId);
    if (!config) {
      throw new Error("Agent config not found");
    }

    const template = await ctx.db.get(config.templateId);
    if (!template) {
      throw new Error("Agent template not found");
    }

    // Merge: template defaultConfig as base, tenant config overrides
    const defaultConfig =
      template.defaultConfig &&
      typeof template.defaultConfig === "object" &&
      !Array.isArray(template.defaultConfig)
        ? (template.defaultConfig as Record<string, unknown>)
        : {};
    const tenantConfig =
      config.config &&
      typeof config.config === "object" &&
      !Array.isArray(config.config)
        ? (config.config as Record<string, unknown>)
        : {};
    const mergedConfig = { ...defaultConfig, ...tenantConfig };

    // Resolve model: config override > platform default
    const model =
      config.modelOverride ?? "claude-sonnet-4-6";

    // Resolve tools from template definitions
    const resolvedTools = template.toolDefinitions ?? [];

    // Resolve credentials for each integration slot
    const resolvedCredentials: Array<{
      slotName: string;
      composioEntityId?: string;
      status: string;
    }> = [];
    for (const slotName of template.integrationSlots) {
      const credential = await ctx.db
        .query("credentials")
        .withIndex("by_tenantId_slotName", (q) =>
          q.eq("tenantId", config.tenantId).eq("slotName", slotName)
        )
        .unique();

      resolvedCredentials.push({
        slotName,
        composioEntityId: credential?.composioEntityId,
        status: credential?.status ?? "pending",
      });
    }

    // Merge system prompt (template system prompt is the base; config can override via mergedConfig)
    const mergedSystemPrompt = template.systemPrompt;

    return {
      mergedSystemPrompt,
      mergedConfig,
      model,
      resolvedTools,
      resolvedCredentials,
    };
  },
});
