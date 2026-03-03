"use client";

import { useRouter } from "next/navigation";
import { StatusBadge } from "./StatusBadge";
import type { ReactNode } from "react";
import type { TenantSummary } from "../../convex/dashboard";

type SortBy = "businessName" | "lastRun" | "monthlyCost";
type SortDir = "asc" | "desc";

type SortControl = {
  sortBy: SortBy;
  sortDir: SortDir;
  onSortChange: (sortBy: SortBy, sortDir: SortDir) => void;
};

type ClientRosterTableProps = {
  tenants: TenantSummary[];
  search: string;
  onSearch: (value: string) => void;
  statusFilter: string;
  onStatusFilter: (value: string) => void;
  sortControls?: SortControl;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyCta?: ReactNode;
};

function formatDate(timestamp: number | null): string {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

export function ClientRosterTable({
  tenants,
  search,
  onSearch,
  statusFilter,
  onStatusFilter,
  sortControls,
  isLoading,
  emptyMessage,
  emptyCta,
}: ClientRosterTableProps) {
  const router = useRouter();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Filters row */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search by business or owner name..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          style={{
            flex: "1 1 240px",
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "0.875rem",
            outline: "none",
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "0.875rem",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="churned">Churned</option>
        </select>

        {sortControls && (
          <>
            <select
              value={sortControls.sortBy}
              onChange={(e) =>
                sortControls.onSortChange(e.target.value as SortBy, sortControls.sortDir)
              }
              style={{
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "0.875rem",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              <option value="businessName">Sort: Business Name</option>
              <option value="lastRun">Sort: Last Run</option>
              <option value="monthlyCost">Sort: Monthly Cost</option>
            </select>
            <select
              value={sortControls.sortDir}
              onChange={(e) =>
                sortControls.onSortChange(sortControls.sortBy, e.target.value as SortDir)
              }
              style={{
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "0.875rem",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af" }}>
          Loading...
        </div>
      ) : tenants.length === 0 ? (
        <div
          style={{
            padding: "48px",
            textAlign: "center",
            color: "#6b7280",
            border: "1px dashed #d1d5db",
            borderRadius: "8px",
          }}
        >
          <p style={{ marginBottom: "12px" }}>{emptyMessage ?? "No clients found."}</p>
          {emptyCta}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.875rem",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                {[
                  "Business Name",
                  "Owner",
                  "Status",
                  "Agents",
                  "Last Run",
                  "Monthly Cost",
                  "Actions",
                ].map((col) => (
                  <th
                    key={col}
                    style={{
                      padding: "10px 12px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "#374151",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr
                  key={tenant.tenantId}
                  style={{ borderBottom: "1px solid #f3f4f6" }}
                >
                  <td style={{ padding: "12px 12px", fontWeight: 500, color: "#111827" }}>
                    {tenant.businessName}
                  </td>
                  <td style={{ padding: "12px 12px", color: "#6b7280" }}>
                    {tenant.ownerName}
                  </td>
                  <td style={{ padding: "12px 12px" }}>
                    <StatusBadge status={tenant.status} />
                  </td>
                  <td style={{ padding: "12px 12px", color: "#374151" }}>
                    {tenant.deployedAgentCount}
                  </td>
                  <td style={{ padding: "12px 12px", color: "#6b7280", whiteSpace: "nowrap" }}>
                    {formatDate(tenant.lastRunAt)}
                  </td>
                  <td style={{ padding: "12px 12px", color: "#374151" }}>
                    {formatCost(tenant.monthlyUsageCost)}
                  </td>
                  <td style={{ padding: "12px 12px" }}>
                    <button
                      onClick={() => router.push(`/clients/${tenant.tenantId}`)}
                      style={{
                        padding: "6px 14px",
                        background: "var(--color-primary, #4f46e5)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "0.8rem",
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
