"use node";

import {
  query,
  action,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { createCipheriv, createDecipheriv, randomBytes, createHmac } from "crypto";
import type { AuthResult } from "./auth";

// ─── Encryption Helpers ────────────────────────────────────────────────────
// IV is 16 bytes = 32 hex chars, prepended to the ciphertext hex string.
// Key: first 32 bytes of ENCRYPTION_KEY interpreted as UTF-8.

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY environment variable is not set");
  return Buffer.from(key, "utf8").subarray(0, 32);
}

export function encrypt(plaintext: string): string {
  const keyBuf = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", keyBuf, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + encrypted;
}

export function decrypt(encryptedHex: string): string {
  const keyBuf = getEncryptionKey();
  const iv = Buffer.from(encryptedHex.slice(0, 32), "hex");
  const decipher = createDecipheriv("aes-256-cbc", keyBuf, iv);
  let decrypted = decipher.update(encryptedHex.slice(32), "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function hmacSha256(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

// ─── Public Actions ────────────────────────────────────────────────────────

/**
 * Save or update Zoom Server-to-Server OAuth credentials for a tenant.
 * Auth: consultant who owns the tenant only.
 *
 * Implemented as an action (not mutation) because Convex mutations run in V8
 * isolates without Node.js APIs. Encryption requires Node.js crypto and
 * process.env, both only available in "use node" files.
 */
export const saveZoomCredentials = action({
  args: {
    tenantId: v.id("tenants"),
    accountId: v.string(),
    clientId: v.string(),
    clientSecret: v.string(),
    webhookSecretToken: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await ctx.runQuery((internal as any).zoomCredentials.getCallerAuth, {});
    if (!auth) {
      throw new Error("Not authenticated");
    }

    if (auth.role !== "consultant" && auth.role !== "platform_admin") {
      throw new Error("Only consultants can manage Zoom credentials");
    }

    const tenant = await ctx.runQuery((internal as any).zoomCredentials.getTenantById, {
      tenantId: args.tenantId,
    });
    if (!tenant) {
      throw new Error("Tenant not found");
    }

    if (auth.role === "consultant" && tenant.consultantId !== auth.consultantId) {
      throw new Error("Not authorized for this tenant");
    }

    const encryptedClientSecret = encrypt(args.clientSecret);
    const encryptedWebhookSecretToken = encrypt(args.webhookSecretToken);

    return await ctx.runMutation((internal as any).zoomCredentials.upsertZoomCredentials, {
      tenantId: args.tenantId,
      accountId: args.accountId,
      clientId: args.clientId,
      clientSecret: encryptedClientSecret,
      webhookSecretToken: encryptedWebhookSecretToken,
    });
  },
});

// ─── Public Queries ────────────────────────────────────────────────────────

/**
 * Returns Zoom connection status for a tenant.
 * Auth: tenant user (client), consultant who owns the tenant, or platform_admin.
 * NEVER returns credentials (clientSecret, webhookSecretToken, accessToken).
 */
export const getZoomConnectionStatus = query({
  args: {
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    if (user.role === "client") {
      if (user.tenantId !== args.tenantId) {
        throw new Error("Not authorized");
      }
    } else if (user.role === "consultant") {
      const tenant = await ctx.db.get(args.tenantId);
      if (!tenant || tenant.consultantId !== user.consultantId) {
        throw new Error("Not authorized");
      }
    }
    // platform_admin: no restriction

    const doc = await ctx.db
      .query("zoomCredentials")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
      .first();

    if (!doc) {
      return { connected: false };
    }

    return {
      connected: true,
      accountId: doc.accountId,
      lastUsedAt: doc.updatedAt,
    };
  },
});

// ─── Internal Queries ─────────────────────────────────────────────────────

/**
 * Internal: return current caller's auth info.
 * Used by saveZoomCredentials action since ActionCtx lacks ctx.db.
 */
export const getCallerAuth = internalQuery({
  args: {},
  handler: async (ctx): Promise<AuthResult | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .unique();

    if (!user) {
      return null;
    }

    return {
      clerkUserId: user.clerkUserId,
      role: user.role,
      tenantId: user.tenantId,
      consultantId: user.consultantId,
    };
  },
});

/**
 * Internal: fetch a tenant by ID.
 * Used by saveZoomCredentials action for ownership check.
 */
export const getTenantById = internalQuery({
  args: {
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.tenantId);
  },
});

/**
 * Internal: return decrypted Zoom credentials for a tenant.
 * Used by Builder-18 (token refresh / API calls) to get plaintext secrets.
 * Returns null if no credentials are stored.
 */
export const getCredentialsForTenant = internalQuery({
  args: {
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args) => {
    const creds = await ctx.db
      .query("zoomCredentials")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
      .unique();

    if (!creds) return null;

    return {
      _id: creds._id,
      accountId: creds.accountId,
      clientId: creds.clientId,
      clientSecret: decrypt(creds.clientSecret),
      webhookSecretToken: decrypt(creds.webhookSecretToken),
      accessToken: creds.accessToken ? decrypt(creds.accessToken) : undefined,
      accessTokenExpiresAt: creds.accessTokenExpiresAt,
    };
  },
});

/**
 * Look up zoomCredentials by accountId (raw, encrypted doc).
 * No index on accountId — filter scan is acceptable (small table).
 */
export const getZoomCredentialsByAccountId = internalQuery({
  args: {
    accountId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("zoomCredentials")
      .filter((q) => q.eq(q.field("accountId"), args.accountId))
      .first();
  },
});

/**
 * Look up zoomCredentials by accountId and return with decrypted webhookSecretToken.
 * Used by the webhook httpAction (V8 runtime) which cannot use Node crypto directly.
 */
export const getDecryptedCredByAccountId = internalQuery({
  args: {
    accountId: v.string(),
  },
  handler: async (ctx, args) => {
    const cred = await ctx.db
      .query("zoomCredentials")
      .filter((q) => q.eq(q.field("accountId"), args.accountId))
      .first();
    if (!cred) return null;
    return {
      tenantId: cred.tenantId,
      webhookSecretToken: decrypt(cred.webhookSecretToken),
    };
  },
});

/**
 * Get any tenant's decrypted webhookSecretToken for the Zoom challenge-response.
 * During initial webhook URL validation, Zoom doesn't include accountId,
 * so we use the first available credential record.
 */
export const getChallengeSecret = internalQuery({
  args: {},
  handler: async (ctx) => {
    const cred = await ctx.db.query("zoomCredentials").first();
    if (!cred) return null;
    return decrypt(cred.webhookSecretToken);
  },
});

/**
 * Look up raw (encrypted) zoomCredentials doc by tenantId.
 * Used when the caller handles decryption itself (e.g. "use node" actions).
 */
export const getZoomCredentialsByTenantId = internalQuery({
  args: {
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("zoomCredentials")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
      .first();
  },
});

// ─── Internal Mutations ────────────────────────────────────────────────────

/**
 * Internal: upsert zoomCredentials doc.
 * clientSecret and webhookSecretToken must already be encrypted by the caller.
 * Clears cached accessToken on upsert (stale token prevention).
 */
export const upsertZoomCredentials = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    accountId: v.string(),
    clientId: v.string(),
    clientSecret: v.string(),
    webhookSecretToken: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("zoomCredentials")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accountId: args.accountId,
        clientId: args.clientId,
        clientSecret: args.clientSecret,
        webhookSecretToken: args.webhookSecretToken,
        // Clear cached access token — credentials changed, token may be stale
        accessToken: undefined,
        accessTokenExpiresAt: undefined,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("zoomCredentials", {
        tenantId: args.tenantId,
        accountId: args.accountId,
        clientId: args.clientId,
        clientSecret: args.clientSecret,
        webhookSecretToken: args.webhookSecretToken,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Internal: update the cached access token.
 * The plaintext accessToken is passed in and encrypted here.
 * Called by token refresh logic (Builder-18) after obtaining a new token.
 */
export const updateAccessToken = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    accessToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("zoomCredentials")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
      .first();

    if (!existing) {
      throw new Error("No Zoom credentials found for this tenant");
    }

    const encryptedToken = encrypt(args.accessToken);
    await ctx.db.patch(existing._id, {
      accessToken: encryptedToken,
      accessTokenExpiresAt: args.expiresAt,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Internal: update the cached access token (pre-encrypted form).
 * Use this when the caller has already encrypted the token (e.g. from another
 * "use node" action that ran encrypt() before calling this mutation).
 */
export const updateZoomToken = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    accessToken: v.string(),
    accessTokenExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("zoomCredentials")
      .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
      .first();

    if (!existing) {
      throw new Error("No Zoom credentials found for this tenant");
    }

    await ctx.db.patch(existing._id, {
      accessToken: args.accessToken,
      accessTokenExpiresAt: args.accessTokenExpiresAt,
      updatedAt: Date.now(),
    });
  },
});
