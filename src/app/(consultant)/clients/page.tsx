"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { ClientRosterTable } from "@/components/ClientRosterTable";

type SortBy = "businessName" | "lastRun" | "monthlyCost";
type SortDir = "asc" | "desc";

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("businessName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientsResult = useQuery((api as any).dashboard.listClientsForConsultant, {
    search: search || undefined,
    status: (statusFilter as "active" | "paused" | "churned") || undefined,
    sortBy,
    sortDir,
  });

  const tenants = clientsResult?.tenants ?? [];
  const isLoading = clientsResult === undefined;

  function handleSortChange(newSortBy: SortBy, newSortDir: SortDir) {
    setSortBy(newSortBy);
    setSortDir(newSortDir);
  }

  return (
    <main id="main-content" tabIndex={-1} style={{ padding: "32px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "#111827",
          marginBottom: "8px",
        }}
      >
        All Clients
      </h1>
      <p style={{ color: "#6b7280", marginBottom: "32px" }}>
        Manage all your clients
      </p>

      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          padding: "24px",
        }}
      >
        <ClientRosterTable
          tenants={tenants}
          search={search}
          onSearch={setSearch}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
          sortControls={{
            sortBy,
            sortDir,
            onSortChange: handleSortChange,
          }}
          isLoading={isLoading}
          emptyMessage="No clients yet."
        />
      </div>
    </main>
  );
}
