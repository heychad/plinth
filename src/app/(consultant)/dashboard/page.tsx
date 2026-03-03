"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { StatCard } from "@/components/StatCard";
import { ClientRosterTable } from "@/components/ClientRosterTable";
import Link from "next/link";

export default function DashboardPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dashboardStats = useQuery((api as any).dashboard.getConsultantDashboard);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientsResult = useQuery((api as any).dashboard.listClientsForConsultant, {
    search: search || undefined,
    status: (statusFilter as "active" | "paused" | "churned") || undefined,
    sortBy: "businessName",
    sortDir: "asc",
  });

  const tenants = clientsResult?.tenants ?? [];
  const statsLoading = dashboardStats === undefined;
  const clientsLoading = clientsResult === undefined;

  return (
    <main style={{ padding: "32px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "#111827",
          marginBottom: "8px",
        }}
      >
        Dashboard
      </h1>
      <p style={{ color: "#6b7280", marginBottom: "32px" }}>
        Your client overview
      </p>

      {/* Stats bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "40px",
        }}
      >
        <StatCard
          title="Active Clients"
          value={statsLoading ? "—" : dashboardStats.activeClientCount}
        />
        <StatCard
          title="Agents Deployed"
          value={statsLoading ? "—" : dashboardStats.totalAgentsDeployed}
        />
        <StatCard
          title="Flagged Reports"
          value={statsLoading ? "—" : dashboardStats.flaggedReportCount}
          accent="#dc2626"
        />
        <StatCard
          title="Monthly Cost"
          value={
            statsLoading
              ? "—"
              : `$${(dashboardStats.monthlyCostUsd ?? 0).toFixed(2)}`
          }
        />
      </div>

      {/* Client roster */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          padding: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#111827", margin: 0 }}>
            Clients
          </h2>
          <Link
            href="/clients"
            style={{
              fontSize: "0.875rem",
              color: "var(--color-primary, #4f46e5)",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            View all →
          </Link>
        </div>

        <ClientRosterTable
          tenants={tenants}
          search={search}
          onSearch={setSearch}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
          isLoading={clientsLoading}
          emptyMessage="No clients yet."
          emptyCta={
            !search && !statusFilter ? (
              <Link
                href="/clients/new"
                style={{
                  display: "inline-block",
                  padding: "8px 20px",
                  background: "var(--color-primary, #4f46e5)",
                  color: "#fff",
                  borderRadius: "6px",
                  textDecoration: "none",
                  fontWeight: 500,
                  fontSize: "0.875rem",
                }}
              >
                Add your first client
              </Link>
            ) : undefined
          }
        />
      </div>
    </main>
  );
}
