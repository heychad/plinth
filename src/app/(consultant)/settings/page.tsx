"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";

type Tab = "profile" | "theme" | "notifications";

const FONT_FAMILIES = ["Inter", "Poppins", "Lato", "Montserrat", "Open Sans"] as const;
type FontFamily = (typeof FONT_FAMILIES)[number];

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/svg+xml"];

function isValidHex(value: string): boolean {
  return HEX_REGEX.test(value);
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentUser = useQuery((api as any).auth.getCurrentUser);
  const [displayName, setDisplayName] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateConsultant = useMutation((api as any).consultants.updateConsultant);

  // Sync displayName from loaded user
  useEffect(() => {
    if (currentUser && displayName === "") {
      setDisplayName(currentUser.displayName ?? "");
    }
  }, [currentUser]);

  async function handleSave() {
    if (!displayName.trim()) {
      setError("Display name cannot be empty.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateConsultant({ displayName: displayName.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (currentUser === undefined) {
    return <p style={{ color: "#6b7280" }}>Loading...</p>;
  }

  return (
    <div style={{ maxWidth: "480px" }}>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111827", marginBottom: "24px" }}>
        Profile
      </h2>

      <div style={{ marginBottom: "20px" }}>
        <label style={labelStyle}>Display Name</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          style={inputStyle}
          placeholder="Your name"
        />
      </div>

      <div style={{ marginBottom: "28px" }}>
        <label style={labelStyle}>Email</label>
        <input
          type="email"
          value={currentUser?.email ?? ""}
          readOnly
          style={{ ...inputStyle, background: "#f9fafb", color: "#6b7280", cursor: "not-allowed" }}
        />
        <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "4px" }}>
          Email is managed by your account provider and cannot be changed here.
        </p>
      </div>

      {error && (
        <p style={{ color: "#dc2626", fontSize: "0.875rem", marginBottom: "12px" }}>{error}</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        style={primaryButtonStyle(saving)}
      >
        {saving ? "Saving..." : saved ? "Saved!" : "Save Profile"}
      </button>
    </div>
  );
}

// ─── Theme Tab ────────────────────────────────────────────────────────────────

type ThemeState = {
  platformName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: FontFamily;
  logoUrl: string | null;
};

const DEFAULT_THEME: ThemeState = {
  platformName: "",
  primaryColor: "#2563EB",
  secondaryColor: "#1E40AF",
  accentColor: "#3B82F6",
  backgroundColor: "#FFFFFF",
  textColor: "#111827",
  fontFamily: "Inter",
  logoUrl: null,
};

function ThemeTab() {
  const savedTheme = useQuery(api.themes.getThemeForCurrentUser);
  const upsertTheme = useMutation(api.themes.upsertTheme);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generateUploadUrl = useMutation((api as any).themes.generateThemeUploadUrl);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateThemeLogo = useMutation((api as any).themes.updateThemeLogo);

  const [theme, setTheme] = useState<ThemeState>(DEFAULT_THEME);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize from saved theme
  useEffect(() => {
    if (savedTheme !== undefined) {
      setTheme({
        platformName: savedTheme?.platformName ?? "",
        primaryColor: savedTheme?.primaryColor ?? DEFAULT_THEME.primaryColor,
        secondaryColor: savedTheme?.secondaryColor ?? DEFAULT_THEME.secondaryColor,
        accentColor: savedTheme?.accentColor ?? DEFAULT_THEME.accentColor,
        backgroundColor: savedTheme?.backgroundColor ?? DEFAULT_THEME.backgroundColor,
        textColor: savedTheme?.textColor ?? DEFAULT_THEME.textColor,
        fontFamily: (savedTheme?.fontFamily ?? DEFAULT_THEME.fontFamily) as FontFamily,
        logoUrl: savedTheme?.logoUrl ?? null,
      });
    }
  }, [savedTheme]);

  function setColor(field: keyof ThemeState, value: string) {
    setTheme((prev) => ({ ...prev, [field]: value }));
  }

  async function handleLogoFile(file: File) {
    setLogoError(null);
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setLogoError("Logo must be PNG, JPEG, or SVG.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("Logo must be smaller than 2 MB.");
      return;
    }
    setLogoUploading(true);
    try {
      const uploadUrl: string = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) {
        throw new Error("Upload failed");
      }
      const { storageId } = await result.json() as { storageId: string };
      await updateThemeLogo({ storageId, type: "logo" });
      // Reload theme to get new logoUrl — useQuery will auto-update
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Logo upload failed.");
    } finally {
      setLogoUploading(false);
    }
  }

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleLogoFile(file);
    },
    [generateUploadUrl, updateThemeLogo]
  );

  async function handleSaveTheme() {
    const colorFields: Array<[keyof ThemeState, string]> = [
      ["primaryColor", theme.primaryColor],
      ["secondaryColor", theme.secondaryColor],
      ["accentColor", theme.accentColor],
      ["backgroundColor", theme.backgroundColor],
      ["textColor", theme.textColor],
    ];
    for (const [field, value] of colorFields) {
      if (!isValidHex(value)) {
        setError(`Invalid hex color for ${String(field)}: ${value}`);
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      await upsertTheme({
        platformName: theme.platformName,
        primaryColor: theme.primaryColor,
        secondaryColor: theme.secondaryColor,
        accentColor: theme.accentColor,
        backgroundColor: theme.backgroundColor,
        textColor: theme.textColor,
        fontFamily: theme.fontFamily,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const previewStyle: React.CSSProperties = {
    background: theme.backgroundColor,
    color: theme.textColor,
    fontFamily: theme.fontFamily,
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    overflow: "hidden",
  };

  const previewHeaderStyle: React.CSSProperties = {
    background: theme.primaryColor,
    padding: "14px 20px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
  };

  const previewNavStyle: React.CSSProperties = {
    background: theme.secondaryColor,
    padding: "8px 20px",
    display: "flex",
    gap: "16px",
  };

  const previewBodyStyle: React.CSSProperties = {
    padding: "20px",
    background: theme.backgroundColor,
  };

  const previewAccentBadge: React.CSSProperties = {
    background: theme.accentColor,
    color: "#fff",
    borderRadius: "4px",
    padding: "2px 8px",
    fontSize: "0.75rem",
    fontWeight: 600,
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", alignItems: "start" }}>
      {/* Left: form */}
      <div>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111827", marginBottom: "24px" }}>
          Theme
        </h2>

        {/* Platform name */}
        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Platform Name</label>
          <input
            type="text"
            value={theme.platformName}
            onChange={(e) => setTheme((prev) => ({ ...prev, platformName: e.target.value }))}
            style={inputStyle}
            placeholder="e.g. Acme Coaching"
          />
        </div>

        {/* Logo upload */}
        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Logo</label>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? "#2563eb" : "#d1d5db"}`,
              borderRadius: "8px",
              padding: "20px",
              textAlign: "center",
              cursor: "pointer",
              background: dragOver ? "#eff6ff" : "#fafafa",
              transition: "border-color 0.15s, background 0.15s",
            }}
          >
            {logoUploading ? (
              <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>Uploading...</p>
            ) : (savedTheme?.logoUrl || theme.logoUrl) ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                                <img
                  src={savedTheme?.logoUrl ?? theme.logoUrl ?? ""}
                  alt="Current logo"
                  style={{ maxHeight: "48px", maxWidth: "120px", objectFit: "contain" }}
                />
                <p style={{ fontSize: "0.75rem", color: "#9ca3af" }}>Click or drag to replace</p>
              </div>
            ) : (
              <div>
                <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "4px" }}>
                  Drag & drop or click to upload
                </p>
                <p style={{ color: "#9ca3af", fontSize: "0.75rem" }}>PNG, JPEG, SVG — max 2 MB</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoFile(file);
              }}
            />
          </div>
          {logoError && (
            <p style={{ color: "#dc2626", fontSize: "0.75rem", marginTop: "4px" }}>{logoError}</p>
          )}
        </div>

        {/* Colors */}
        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Colors</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {(
              [
                ["primaryColor", "Primary"],
                ["secondaryColor", "Secondary"],
                ["accentColor", "Accent"],
                ["backgroundColor", "Background"],
                ["textColor", "Text"],
              ] as const
            ).map(([field, label]) => (
              <div key={field}>
                <label style={{ ...labelStyle, marginBottom: "4px" }}>{label}</label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="color"
                    value={isValidHex(theme[field] as string) ? (theme[field] as string) : "#000000"}
                    onChange={(e) => setColor(field, e.target.value)}
                    style={{
                      width: "40px",
                      height: "36px",
                      padding: "2px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  />
                  <input
                    type="text"
                    value={theme[field] as string}
                    onChange={(e) => setColor(field, e.target.value)}
                    maxLength={7}
                    style={{
                      ...inputStyle,
                      width: "100px",
                      fontFamily: "monospace",
                      borderColor: isValidHex(theme[field] as string) ? "#d1d5db" : "#dc2626",
                    }}
                    placeholder="#000000"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Font family */}
        <div style={{ marginBottom: "28px" }}>
          <label style={labelStyle}>Font Family</label>
          <select
            value={theme.fontFamily}
            onChange={(e) => setTheme((prev) => ({ ...prev, fontFamily: e.target.value as FontFamily }))}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        {error && (
          <p style={{ color: "#dc2626", fontSize: "0.875rem", marginBottom: "12px" }}>{error}</p>
        )}

        <button
          onClick={handleSaveTheme}
          disabled={saving}
          style={primaryButtonStyle(saving)}
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save Theme"}
        </button>
      </div>

      {/* Right: live preview */}
      <div>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111827", marginBottom: "24px" }}>
          Preview
        </h2>
        <div style={previewStyle}>
          {/* Header */}
          <div style={previewHeaderStyle}>
            {(savedTheme?.logoUrl || theme.logoUrl) && (
              <img
                src={savedTheme?.logoUrl ?? theme.logoUrl ?? ""}
                alt="Logo preview"
                style={{ height: "28px", objectFit: "contain" }}
              />
            )}
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "1rem", fontFamily: theme.fontFamily }}>
              {theme.platformName || "Your Platform"}
            </span>
          </div>
          {/* Nav bar */}
          <div style={previewNavStyle}>
            {["Agents", "Runs", "Reports"].map((item) => (
              <span
                key={item}
                style={{
                  color: "rgba(255,255,255,0.85)",
                  fontSize: "0.8rem",
                  fontFamily: theme.fontFamily,
                  cursor: "default",
                }}
              >
                {item}
              </span>
            ))}
          </div>
          {/* Body */}
          <div style={previewBodyStyle}>
            <p style={{ fontFamily: theme.fontFamily, fontWeight: 600, color: theme.textColor, marginBottom: "8px", fontSize: "0.9rem" }}>
              Welcome back, Alex
            </p>
            <p style={{ fontFamily: theme.fontFamily, color: theme.textColor, fontSize: "0.8rem", opacity: 0.7, marginBottom: "12px" }}>
              Here is your agent overview for this month.
            </p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <span style={previewAccentBadge}>3 Agents Active</span>
              <span
                style={{
                  background: theme.primaryColor,
                  color: "#fff",
                  borderRadius: "4px",
                  padding: "2px 10px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "default",
                }}
              >
                View Reports
              </span>
            </div>
          </div>
        </div>
        <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "8px" }}>
          Preview updates in real-time. Click &ldquo;Save Theme&rdquo; to apply.
        </p>
      </div>
    </div>
  );
}

// ─── Notifications Tab ────────────────────────────────────────────────────────

function NotificationsTab() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientsResult = useQuery((api as any).dashboard.listClientsForConsultant, {
    sortBy: "businessName",
    sortDir: "asc",
  });

  const updateAgentConfig = useMutation(api.agentConfigs.updateAgentConfig);

  const [thresholds, setThresholds] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Get all tenants from the clients result so we can query their agentConfigs.
  // CoachingConfigsForTenant renders per-tenant using a child component that
  // calls useQuery unconditionally — React hooks rules are satisfied this way.
  const tenants = clientsResult?.tenants ?? [];

  function getThreshold(configId: string, defaultVal: number): number {
    return thresholds[configId] !== undefined ? thresholds[configId] : defaultVal;
  }

  async function handleSave(configId: string) {
    const threshold = thresholds[configId];
    if (threshold === undefined) return;
    if (threshold < 0 || threshold > 100) {
      setErrors((prev) => ({ ...prev, [configId]: "Threshold must be between 0 and 100." }));
      return;
    }
    setSavingId(configId);
    setErrors((prev) => ({ ...prev, [configId]: "" }));
    try {
      await updateAgentConfig({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        agentConfigId: configId as any,
        config: { notificationThreshold: threshold },
      });
      setSavedId(configId);
      setTimeout(() => setSavedId(null), 2500);
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [configId]: err instanceof Error ? err.message : "Save failed.",
      }));
    } finally {
      setSavingId(null);
    }
  }

  if (clientsResult === undefined) {
    return <p style={{ color: "#6b7280" }}>Loading...</p>;
  }

  return (
    <div style={{ maxWidth: "640px" }}>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111827", marginBottom: "8px" }}>
        Notifications
      </h2>
      <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "28px" }}>
        Set a score threshold for coaching program deployments. You will be notified when a call
        scores below the threshold.
      </p>

      {tenants.length === 0 && (
        <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
          No clients yet. Add a client and deploy a coaching program to configure notifications.
        </p>
      )}

      {tenants.map((tenant: { tenantId: string; businessName: string }) => (
        <CoachingConfigsForTenant
          key={tenant.tenantId}
          tenantId={tenant.tenantId}
          tenantBusinessName={tenant.businessName}
          thresholds={thresholds}
          onThresholdChange={(configId, val) =>
            setThresholds((prev) => ({ ...prev, [configId]: val }))
          }
          onSave={handleSave}
          savingId={savingId}
          savedId={savedId}
          errors={errors}
          getThreshold={getThreshold}
        />
      ))}
    </div>
  );
}

type CoachingConfigsForTenantProps = {
  tenantId: string;
  tenantBusinessName: string;
  thresholds: Record<string, number>;
  onThresholdChange: (configId: string, val: number) => void;
  onSave: (configId: string) => Promise<void>;
  savingId: string | null;
  savedId: string | null;
  errors: Record<string, string>;
  getThreshold: (configId: string, defaultVal: number) => number;
};

function CoachingConfigsForTenant({
  tenantId,
  tenantBusinessName,
  thresholds,
  onThresholdChange,
  onSave,
  savingId,
  savedId,
  errors,
  getThreshold,
}: CoachingConfigsForTenantProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentConfigs = useQuery((api as any).agentConfigs.listAgentConfigsForTenant, {
    tenantId,
    paginationOpts: { numItems: 50, cursor: null },
  });

  const configs = agentConfigs?.page ?? [];

  // Filter to coaching configs only (those that have config.notificationThreshold or are in coaching category)
  // Since we don't have category directly on agentConfig, we check for notificationThreshold in config
  // or include all deployed configs as candidates
  const deployedConfigs = configs.filter(
    (c: { status: string }) => c.status === "deployed" || c.status === "testing"
  );

  if (deployedConfigs.length === 0) return null;

  return (
    <div
      style={{
        marginBottom: "28px",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          background: "#f9fafb",
          borderBottom: "1px solid #e5e7eb",
          fontWeight: 600,
          fontSize: "0.875rem",
          color: "#374151",
        }}
      >
        {tenantBusinessName}
      </div>
      <div style={{ padding: "16px" }}>
        {deployedConfigs.map(
          (config: { _id: string; displayName: string; config: Record<string, unknown> }) => {
            const defaultThreshold =
              typeof config.config?.notificationThreshold === "number"
                ? (config.config.notificationThreshold as number)
                : 70;
            const isSaving = savingId === config._id;
            const isSaved = savedId === config._id;
            const err = errors[config._id];

            return (
              <div
                key={config._id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  flexWrap: "wrap",
                  marginBottom: "12px",
                  paddingBottom: "12px",
                  borderBottom: "1px solid #f3f4f6",
                }}
              >
                <div style={{ flex: 1, minWidth: "160px" }}>
                  <p style={{ fontWeight: 500, fontSize: "0.875rem", color: "#111827", margin: 0 }}>
                    {config.displayName}
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "#9ca3af", margin: "2px 0 0" }}>
                    Notify me when a call scores below:
                  </p>
                </div>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={thresholds[config._id] !== undefined ? thresholds[config._id] : defaultThreshold}
                  onChange={(e) =>
                    onThresholdChange(config._id, parseInt(e.target.value, 10))
                  }
                  style={{
                    ...inputStyle,
                    width: "72px",
                    textAlign: "center",
                    fontWeight: 600,
                    fontSize: "1rem",
                  }}
                />
                <button
                  onClick={() => onSave(config._id)}
                  disabled={isSaving || thresholds[config._id] === undefined}
                  style={{
                    ...primaryButtonStyle(isSaving || thresholds[config._id] === undefined),
                    padding: "6px 14px",
                    fontSize: "0.8rem",
                  }}
                >
                  {isSaving ? "Saving..." : isSaved ? "Saved!" : "Save"}
                </button>
                {err && (
                  <p style={{ color: "#dc2626", fontSize: "0.75rem", width: "100%", margin: 0 }}>
                    {err}
                  </p>
                )}
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "#374151",
  marginBottom: "6px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid #d1d5db",
  borderRadius: "6px",
  fontSize: "0.875rem",
  color: "#111827",
  outline: "none",
  boxSizing: "border-box",
};

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "8px 20px",
    background: disabled ? "#9ca3af" : "var(--color-primary, #2563eb)",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontWeight: 600,
    fontSize: "0.875rem",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background 0.15s",
  };
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  const tabs: { id: Tab; label: string }[] = [
    { id: "profile", label: "Profile" },
    { id: "theme", label: "Theme" },
    { id: "notifications", label: "Notifications" },
  ];

  return (
    <main style={{ padding: "32px", maxWidth: "1100px", margin: "0 auto" }}>
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "#111827",
          marginBottom: "8px",
        }}
      >
        Settings
      </h1>
      <p style={{ color: "#6b7280", marginBottom: "28px" }}>
        Manage your profile, branding, and notification preferences.
      </p>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          borderBottom: "2px solid #e5e7eb",
          marginBottom: "32px",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "10px 20px",
              background: "none",
              border: "none",
              borderBottom:
                activeTab === tab.id
                  ? "2px solid var(--color-primary, #2563eb)"
                  : "2px solid transparent",
              marginBottom: "-2px",
              fontWeight: activeTab === tab.id ? 700 : 500,
              color:
                activeTab === tab.id
                  ? "var(--color-primary, #2563eb)"
                  : "#6b7280",
              cursor: "pointer",
              fontSize: "0.9rem",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          padding: "28px",
        }}
      >
        {activeTab === "profile" && <ProfileTab />}
        {activeTab === "theme" && <ThemeTab />}
        {activeTab === "notifications" && <NotificationsTab />}
      </div>
    </main>
  );
}
