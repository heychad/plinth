import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";

export type AuthResult = {
  clerkUserId: string;
  role: string;
  tenantId?: Id<"tenants">;
  consultantId?: Id<"consultants">;
};

export async function requireAuth(
  ctx: QueryCtx | MutationCtx
): Promise<AuthResult> {
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

  return {
    clerkUserId: user.clerkUserId,
    role: user.role,
    tenantId: user.tenantId,
    consultantId: user.consultantId,
  };
}

export function requireRole(auth: AuthResult, requiredRole: string): void {
  if (auth.role !== requiredRole) {
    throw new Error(`Requires role: ${requiredRole}`);
  }
}

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .unique();

    return user ?? null;
  },
});
