"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientDetailTabs, TabSkeleton } from "./_components/ClientDetailTabs";

const statusVariant: Record<string, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  paused: {
    label: "Paused",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  churned: {
    label: "Churned",
    className: "bg-muted text-muted-foreground border-muted",
  },
};

function ClientDetailSkeleton() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="px-6 py-6 lg:px-8 max-w-5xl mx-auto"
    >
      <Skeleton className="h-4 w-48 mb-6" />
      <div className="flex items-center gap-3 mb-1">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-32 mb-8" />
      <div className="flex gap-2 border-b pb-0 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28" />
        ))}
      </div>
      <TabSkeleton />
    </main>
  );
}

export default function ClientDetailPage() {
  const params = useParams();
  const tenantId = params.tenantId as Id<"tenants">;
  const data = useQuery(api.clientDetail.getClientDetail, { tenantId });

  if (data === undefined) {
    return <ClientDetailSkeleton />;
  }

  if (data === null) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="px-6 py-6 lg:px-8 max-w-5xl mx-auto"
      >
        <p className="text-destructive">Client not found or access denied.</p>
      </main>
    );
  }

  const { tenant, agentConfigs, recentRuns, reports } = data;
  const status = statusVariant[tenant.status] ?? {
    label: tenant.status,
    className: "bg-muted text-muted-foreground border-muted",
  };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="px-6 py-6 lg:px-8 max-w-5xl mx-auto"
    >
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/clients">Clients</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{tenant.businessName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-8 border-b pb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight">
            {tenant.businessName}
          </h1>
          <Badge
            role="status"
            aria-label={`Status: ${status.label}`}
            variant="outline"
            className={status.className}
          >
            {status.label}
          </Badge>
        </div>
        {tenant.ownerName && (
          <p className="mt-1 text-sm text-muted-foreground">
            {tenant.ownerName}
          </p>
        )}
      </div>

      <ClientDetailTabs
        tenantId={tenantId}
        tenant={tenant}
        agentConfigs={agentConfigs}
        recentRuns={recentRuns}
        reports={reports}
      />
    </main>
  );
}
