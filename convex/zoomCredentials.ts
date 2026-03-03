"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import type { Id } from "./_generated/dataModel";

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
  // eslint-disable-next-line no-undef
  const { createHmac } = require("crypto");
  return createHmac("sha256", secret).update(message).digest("hex");
}

// ─── Public Actions ────────────────────────────────────────────────────────

export const saveZoomCredentials = action({
  args: {
    tenantId: v.id("tenants"),
    accountId: v.string(),
    clientId: v.string(),
    clientSecret: v.string(),
    webhookSecretToken: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"zoomCredentials">> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const auth: any = await ctx.runQuery((internal as any).zoomCredentialsDb.getCallerAuth, {});
    if (!auth) {
      throw new Error("Not authenticated");
    }

    if (auth.role !== "consultant" && auth.role !== "platform_admin") {
      throw new Error("Only consultants can manage Zoom credentials");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tenant: any = await ctx.runQuery((internal as any).zoomCredentialsDb.getTenantById, {
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

    return await ctx.runMutation((internal as any).zoomCredentialsDb.upsertZoomCredentials, {
      tenantId: args.tenantId,
      accountId: args.accountId,
      clientId: args.clientId,
      clientSecret: encryptedClientSecret,
      webhookSecretToken: encryptedWebhookSecretToken,
    });
  },
});

// ─── Internal Actions (crypto-dependent, formerly queries/mutations) ──────

/**
 * Returns decrypted Zoom credentials for a tenant.
 * Converted from internalQuery to internalAction because it uses Node crypto.
 */
export const getCredentialsForTenant = internalAction({
  args: {
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args): Promise<{
    _id: string;
    accountId: string;
    clientId: string;
    clientSecret: string;
    webhookSecretToken: string;
    accessToken: string | undefined;
    accessTokenExpiresAt: number | undefined;
  } | null> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const creds: any = await ctx.runQuery(
      (internal as any).zoomCredentialsDb.getRawCredByTenantId,
      { tenantId: args.tenantId }
    );

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
 * Look up zoomCredentials by accountId and return with decrypted webhookSecretToken.
 * Converted from internalQuery to internalAction because it uses Node crypto.
 */
export const getDecryptedCredByAccountId = internalAction({
  args: {
    accountId: v.string(),
  },
  handler: async (ctx, args): Promise<{
    tenantId: Id<"tenants">;
    webhookSecretToken: string;
  } | null> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cred: any = await ctx.runQuery(
      (internal as any).zoomCredentialsDb.getRawCredByAccountId,
      { accountId: args.accountId }
    );
    if (!cred) return null;
    return {
      tenantId: cred.tenantId,
      webhookSecretToken: decrypt(cred.webhookSecretToken),
    };
  },
});

/**
 * Get any tenant's decrypted webhookSecretToken for the Zoom challenge-response.
 * Converted from internalQuery to internalAction because it uses Node crypto.
 */
export const getChallengeSecret = internalAction({
  args: {},
  handler: async (ctx): Promise<string | null> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cred: any = await ctx.runQuery(
      (internal as any).zoomCredentialsDb.getRawFirstCredential,
      {}
    );
    if (!cred) return null;
    return decrypt(cred.webhookSecretToken);
  },
});

/**
 * Update the cached access token (encrypts before storing).
 * Converted from internalMutation to internalAction because it uses Node crypto.
 */
export const updateAccessToken = internalAction({
  args: {
    tenantId: v.id("tenants"),
    accessToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const encryptedToken = encrypt(args.accessToken);
    await ctx.runMutation(
      (internal as any).zoomCredentialsDb.updateZoomToken,
      {
        tenantId: args.tenantId,
        accessToken: encryptedToken,
        accessTokenExpiresAt: args.expiresAt,
      }
    );
  },
});
