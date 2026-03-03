import { httpAction, internalAction, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

// ─── Web Crypto HMAC-SHA256 (V8-compatible, no Node crypto needed) ───────────

async function hmacSha256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * POST /webhooks/github-template-sync
 *
 * Handles GitHub push webhook events:
 * - Validates HMAC-SHA256 signature from x-hub-signature-256 header
 * - Only processes pushes to the main branch
 * - Filters changed files to templates\/**\/*.json
 * - Schedules syncTemplateFromGit for each changed template slug
 * - Returns 200 immediately — sync runs asynchronously
 */
export const githubWebhook = httpAction(async (ctx, request) => {
  // ── Read raw body first (needed for signature validation) ─────────────────
  const rawBody = await request.text();

  // ── Validate GitHub HMAC-SHA256 signature ─────────────────────────────────
  const signatureHeader = request.headers.get("x-hub-signature-256") ?? "";
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[github-webhook] GITHUB_WEBHOOK_SECRET not configured");
    return new Response("Server configuration error", { status: 500 });
  }

  const expectedHash = await hmacSha256(webhookSecret, rawBody);
  const expectedSignature = `sha256=${expectedHash}`;

  if (signatureHeader !== expectedSignature) {
    return new Response("Signature mismatch", { status: 401 });
  }

  // ── Parse push event payload ───────────────────────────────────────────────
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // ── Only process pushes to main branch ────────────────────────────────────
  const ref = payload.ref as string | undefined;
  if (ref !== "refs/heads/main") {
    return new Response("OK", { status: 200 });
  }

  // ── Extract changed files from commits ────────────────────────────────────
  const commits = (payload.commits as Array<Record<string, unknown>>) ?? [];
  const commitSha = (payload.after as string) ?? "";

  const changedFiles = new Set<string>();
  for (const commit of commits) {
    const added = (commit.added as string[]) ?? [];
    const modified = (commit.modified as string[]) ?? [];
    for (const file of [...added, ...modified]) {
      changedFiles.add(file);
    }
  }

  // ── Filter to templates/**/*.json and extract unique slugs ────────────────
  const templateSlugs = new Set<string>();
  for (const file of changedFiles) {
    // Match files like: templates/{slug}/template.json
    //                   templates/{slug}/pipeline-steps.json
    //                   templates/{slug}/default-config.json
    const match = file.match(/^templates\/([^/]+)\/.+\.json$/);
    if (match) {
      templateSlugs.add(match[1]);
    }
  }

  // ── Schedule syncTemplateFromGit for each changed template slug ───────────
  for (const templateSlug of templateSlugs) {
    await ctx.scheduler.runAfter(
      0,
      (internal as any).webhooks.github.syncTemplateFromGit,
      { templateSlug, commitSha }
    );
  }

  return new Response("OK", { status: 200 });
});

/**
 * Internal action: fetch template files from GitHub and upsert agentTemplate.
 *
 * Fetches:
 * - templates/{slug}/template.json
 * - templates/{slug}/pipeline-steps.json  (optional)
 * - templates/{slug}/default-config.json  (optional)
 *
 * Returns { status: "created" | "updated" | "unchanged" }
 * On any error: logs and skips — does not corrupt existing template.
 */
export const syncTemplateFromGit = internalAction({
  args: {
    templateSlug: v.string(),
    commitSha: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ status: "created" | "updated" | "unchanged" }> => {
    const { templateSlug, commitSha } = args;

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      console.error(
        `[github-sync] GITHUB_TOKEN not configured (slug: ${templateSlug})`
      );
      return { status: "unchanged" };
    }

    // ── Helper: fetch a single file from GitHub Contents API ──────────────────
    async function fetchGitHubFile(
      filePath: string
    ): Promise<unknown | null> {
      const repoOwner = process.env.GITHUB_TEMPLATE_REPO_OWNER ?? "plinth";
      const repoName = process.env.GITHUB_TEMPLATE_REPO_NAME ?? "plinth-templates";
      const url = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}?ref=${commitSha}`;

      let response: Response;
      try {
        response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "plinth-sync/1.0",
          },
        });
      } catch (err) {
        console.error(`[github-sync] Network error fetching ${filePath}:`, err);
        return null;
      }

      if (response.status === 404) {
        return null; // File doesn't exist — not an error
      }

      if (!response.ok) {
        console.error(
          `[github-sync] GitHub API error for ${filePath}: ${response.status} ${response.statusText}`
        );
        return null;
      }

      let apiResponse: Record<string, unknown>;
      try {
        apiResponse = (await response.json()) as Record<string, unknown>;
      } catch {
        console.error(
          `[github-sync] Failed to parse GitHub API response for ${filePath}`
        );
        return null;
      }

      // GitHub Contents API returns base64-encoded content
      const contentBase64 = apiResponse.content as string | undefined;
      if (!contentBase64) {
        console.error(
          `[github-sync] No content field in GitHub response for ${filePath}`
        );
        return null;
      }

      // Decode base64 content (GitHub includes newlines in encoding)
      const contentStr = atob(contentBase64.replace(/\n/g, ""));

      try {
        return JSON.parse(contentStr);
      } catch {
        console.error(
          `[github-sync] Malformed JSON in ${filePath} at commit ${commitSha} — skipping`
        );
        return null;
      }
    }

    // ── Fetch all three files in parallel ─────────────────────────────────────
    const [rawTemplate, rawPipelineSteps, rawDefaultConfig] =
      await Promise.all([
        fetchGitHubFile(`templates/${templateSlug}/template.json`),
        fetchGitHubFile(`templates/${templateSlug}/pipeline-steps.json`),
        fetchGitHubFile(`templates/${templateSlug}/default-config.json`),
      ]);

    // template.json is required — skip if missing or not an object
    if (!rawTemplate || typeof rawTemplate !== "object" || Array.isArray(rawTemplate)) {
      console.error(
        `[github-sync] template.json missing or invalid for slug "${templateSlug}" at commit ${commitSha} — skipping`
      );
      return { status: "unchanged" };
    }

    const templateJson = rawTemplate as Record<string, unknown>;

    // ── Validate required fields from template.json ────────────────────────────
    const requiredFields = [
      "displayName",
      "description",
      "category",
      "isActive",
      "isPipeline",
      "executionMode",
      "systemPrompt",
      "integrationSlots",
      "inputSchema",
      "defaultLockedFields",
      "defaultCustomizableFields",
    ];

    for (const field of requiredFields) {
      if (templateJson[field] === undefined) {
        console.error(
          `[github-sync] template.json for "${templateSlug}" missing required field "${field}" at commit ${commitSha} — skipping`
        );
        return { status: "unchanged" };
      }
    }

    // ── Validate category value ────────────────────────────────────────────────
    const validCategories = ["marketing", "sales", "operations", "coaching"];
    if (!validCategories.includes(templateJson.category as string)) {
      console.error(
        `[github-sync] Invalid category "${templateJson.category}" for "${templateSlug}" — skipping`
      );
      return { status: "unchanged" };
    }

    // ── Validate executionMode value ───────────────────────────────────────────
    const validModes = ["autonomous", "simple"];
    if (!validModes.includes(templateJson.executionMode as string)) {
      console.error(
        `[github-sync] Invalid executionMode "${templateJson.executionMode}" for "${templateSlug}" — skipping`
      );
      return { status: "unchanged" };
    }

    // pipeline-steps.json should contain an array at root
    const pipelineSteps = Array.isArray(rawPipelineSteps)
      ? (rawPipelineSteps as Array<Record<string, unknown>>)
      : undefined;

    // default-config.json should be an object
    const defaultConfig =
      rawDefaultConfig && typeof rawDefaultConfig === "object" && !Array.isArray(rawDefaultConfig)
        ? rawDefaultConfig
        : {};

    // ── Upsert via internal mutation (DB access requires mutation context) ─────
    try {
      const result = await ctx.runMutation(
        (internal as any).webhooks.github.upsertTemplateFromGit,
        {
          templateSlug,
          commitSha,
          displayName: templateJson.displayName as string,
          description: templateJson.description as string,
          category: templateJson.category as string,
          isActive: Boolean(templateJson.isActive),
          isPipeline: Boolean(templateJson.isPipeline),
          executionMode: templateJson.executionMode as string,
          estimatedDurationSeconds:
            typeof templateJson.estimatedDurationSeconds === "number"
              ? templateJson.estimatedDurationSeconds
              : undefined,
          systemPrompt: templateJson.systemPrompt as string,
          integrationSlots:
            (templateJson.integrationSlots as string[]) ?? [],
          inputSchema: templateJson.inputSchema,
          defaultLockedFields:
            (templateJson.defaultLockedFields as string[]) ?? [],
          defaultCustomizableFields:
            (templateJson.defaultCustomizableFields as string[]) ?? [],
          toolDefinitions: templateJson.toolDefinitions as
            | Array<Record<string, unknown>>
            | undefined,
          defaultConfig,
          pipelineSteps,
        }
      );
      return result as { status: "created" | "updated" | "unchanged" };
    } catch (err) {
      console.error(
        `[github-sync] Failed to upsert template "${templateSlug}" at commit ${commitSha}:`,
        err
      );
      return { status: "unchanged" };
    }
  },
});

/**
 * Internal mutation: upsert an agentTemplate document from git sync.
 * Matches by slug — creates if new, updates (incrementing version) if exists.
 *
 * For new templates, attempts to find a platform_admin user for createdBy.
 * If no platform_admin user exists, logs an error and skips creation.
 */
export const upsertTemplateFromGit = internalMutation({
  args: {
    templateSlug: v.string(),
    commitSha: v.string(),
    displayName: v.string(),
    description: v.string(),
    category: v.union(
      v.literal("marketing"),
      v.literal("sales"),
      v.literal("operations"),
      v.literal("coaching")
    ),
    isActive: v.boolean(),
    isPipeline: v.boolean(),
    executionMode: v.union(v.literal("autonomous"), v.literal("simple")),
    estimatedDurationSeconds: v.optional(v.number()),
    systemPrompt: v.string(),
    integrationSlots: v.array(v.string()),
    inputSchema: v.any(),
    defaultLockedFields: v.array(v.string()),
    defaultCustomizableFields: v.array(v.string()),
    toolDefinitions: v.optional(v.array(v.any())),
    defaultConfig: v.any(),
    pipelineSteps: v.optional(v.array(v.any())),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ status: "created" | "updated" | "unchanged" }> => {
    const now = Date.now();

    // ── Check if template already exists by slug ───────────────────────────────
    const existing = await ctx.db
      .query("agentTemplates")
      .withIndex("by_slug", (q) => q.eq("slug", args.templateSlug))
      .first();

    const templateFields = {
      displayName: args.displayName,
      description: args.description,
      category: args.category,
      isActive: args.isActive,
      isPipeline: args.isPipeline,
      executionMode: args.executionMode,
      estimatedDurationSeconds: args.estimatedDurationSeconds,
      systemPrompt: args.systemPrompt,
      integrationSlots: args.integrationSlots,
      inputSchema: args.inputSchema,
      defaultLockedFields: args.defaultLockedFields,
      defaultCustomizableFields: args.defaultCustomizableFields,
      defaultConfig: args.defaultConfig,
      ...(args.pipelineSteps !== undefined
        ? { pipelineSteps: args.pipelineSteps }
        : {}),
      ...(args.toolDefinitions !== undefined
        ? { toolDefinitions: args.toolDefinitions }
        : {}),
      updatedAt: now,
    };

    if (existing) {
      // ── Update existing template, increment version ────────────────────────
      await ctx.db.patch(existing._id, {
        ...templateFields,
        version: existing.version + 1,
      });

      console.log(
        `[github-sync] Updated template "${args.templateSlug}" to version ${existing.version + 1} (commit: ${args.commitSha})`
      );
      return { status: "updated" };
    }

    // ── New template — find a platform_admin user for createdBy ───────────────
    const platformAdmin = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "platform_admin"))
      .first();

    if (!platformAdmin) {
      console.error(
        `[github-sync] Cannot create template "${args.templateSlug}": no platform_admin user found. ` +
          `Seed a platform_admin user first.`
      );
      return { status: "unchanged" };
    }

    await ctx.db.insert("agentTemplates", {
      slug: args.templateSlug,
      ...templateFields,
      version: 1,
      createdBy: platformAdmin._id,
      createdAt: now,
    });

    console.log(
      `[github-sync] Created template "${args.templateSlug}" version 1 (commit: ${args.commitSha})`
    );
    return { status: "created" };
  },
});
