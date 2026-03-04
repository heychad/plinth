import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const VALID_FONT_FAMILIES = ["Inter", "Poppins", "Lato", "Montserrat", "Open Sans", "Plus Jakarta Sans"] as const;

function validateHexColor(value: string, fieldName: string): void {
  if (!HEX_COLOR_REGEX.test(value)) {
    throw new Error(`Invalid hex color: ${fieldName}`);
  }
}

export const getThemeByConsultantId = query({
  args: { consultantId: v.id("consultants") },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    if (auth.role === "consultant") {
      if (auth.consultantId !== args.consultantId) {
        throw new Error("Not authorized");
      }
    } else if (auth.role === "client") {
      const tenant = await ctx.db.get(auth.tenantId!);
      if (!tenant || tenant.consultantId !== args.consultantId) {
        throw new Error("Not authorized");
      }
    } else if (auth.role !== "platform_admin") {
      throw new Error("Not authorized");
    }

    return await ctx.db
      .query("themes")
      .withIndex("by_consultantId", (q) => q.eq("consultantId", args.consultantId))
      .unique();
  },
});

export const getThemeForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const auth = await requireAuth(ctx);

    if (auth.role === "platform_admin") {
      return null;
    }

    let consultantId = auth.consultantId;

    if (auth.role === "client") {
      const tenant = await ctx.db.get(auth.tenantId!);
      if (!tenant) {
        return null;
      }
      consultantId = tenant.consultantId;
    }

    if (!consultantId) {
      return null;
    }

    return await ctx.db
      .query("themes")
      .withIndex("by_consultantId", (q) => q.eq("consultantId", consultantId!))
      .unique();
  },
});

export const upsertTheme = mutation({
  args: {
    platformName: v.string(),
    primaryColor: v.string(),
    secondaryColor: v.string(),
    accentColor: v.string(),
    backgroundColor: v.string(),
    textColor: v.string(),
    fontFamily: v.string(),
    supportEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    if (auth.role !== "consultant") {
      throw new Error("Not authorized");
    }

    validateHexColor(args.primaryColor, "primaryColor");
    validateHexColor(args.secondaryColor, "secondaryColor");
    validateHexColor(args.accentColor, "accentColor");
    validateHexColor(args.backgroundColor, "backgroundColor");
    validateHexColor(args.textColor, "textColor");

    if (!(VALID_FONT_FAMILIES as readonly string[]).includes(args.fontFamily)) {
      throw new Error(`Invalid font family: ${args.fontFamily}`);
    }

    const consultantId = auth.consultantId!;
    const now = Date.now();

    const existing = await ctx.db
      .query("themes")
      .withIndex("by_consultantId", (q) => q.eq("consultantId", consultantId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        platformName: args.platformName,
        primaryColor: args.primaryColor,
        secondaryColor: args.secondaryColor,
        accentColor: args.accentColor,
        backgroundColor: args.backgroundColor,
        textColor: args.textColor,
        fontFamily: args.fontFamily,
        supportEmail: args.supportEmail,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("themes", {
      consultantId,
      platformName: args.platformName,
      primaryColor: args.primaryColor,
      secondaryColor: args.secondaryColor,
      accentColor: args.accentColor,
      backgroundColor: args.backgroundColor,
      textColor: args.textColor,
      fontFamily: args.fontFamily,
      supportEmail: args.supportEmail,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const generateThemeUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const auth = await requireAuth(ctx);

    if (auth.role !== "consultant") {
      throw new Error("Not authorized");
    }

    return await ctx.storage.generateUploadUrl();
  },
});

export const updateThemeLogo = mutation({
  args: {
    storageId: v.id("_storage"),
    type: v.union(v.literal("logo"), v.literal("favicon")),
  },
  handler: async (ctx, args) => {
    const auth = await requireAuth(ctx);

    if (auth.role !== "consultant") {
      throw new Error("Not authorized");
    }

    const consultantId = auth.consultantId!;
    const now = Date.now();

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      throw new Error("Storage URL not found");
    }

    const existing = await ctx.db
      .query("themes")
      .withIndex("by_consultantId", (q) => q.eq("consultantId", consultantId))
      .unique();

    if (existing) {
      const patch =
        args.type === "logo"
          ? { logoUrl: url, updatedAt: now }
          : { faviconUrl: url, updatedAt: now };
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    // No theme exists yet — create a minimal one with the logo set
    const themeId = await ctx.db.insert("themes", {
      consultantId,
      platformName: "",
      primaryColor: "#000000",
      secondaryColor: "#000000",
      accentColor: "#000000",
      backgroundColor: "#ffffff",
      textColor: "#000000",
      fontFamily: "Inter",
      logoUrl: args.type === "logo" ? url : undefined,
      faviconUrl: args.type === "favicon" ? url : undefined,
      createdAt: now,
      updatedAt: now,
    });

    return themeId;
  },
});
