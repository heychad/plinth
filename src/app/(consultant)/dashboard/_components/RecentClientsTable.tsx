"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { TenantSummary } from "../../../../../convex/dashboard";

function formatDate(timestamp: number | null): string {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "active"
      ? "default"
      : status === "paused"
        ? "secondary"
        : "destructive";
  return (
    <Badge variant={variant} role="status" aria-label={`Status: ${status}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-[30%]" />
          <Skeleton className="h-4 w-[15%]" />
          <Skeleton className="h-4 w-[10%]" />
          <Skeleton className="h-4 w-[20%]" />
        </div>
      ))}
    </div>
  );
}

type RecentClientsTableProps = {
  clients: TenantSummary[];
  isLoading: boolean;
};

export function RecentClientsTable({
  clients,
  isLoading,
}: RecentClientsTableProps) {
  const recentClients = clients.slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Recent Clients</CardTitle>
        <Button variant="link" asChild className="px-0">
          <Link href="/clients">View all clients &rarr;</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <TableSkeleton />
        ) : recentClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
            <p className="mb-3 text-sm text-muted-foreground">
              No clients yet.
            </p>
            <Button asChild>
              <Link href="/clients/new">Add your first client</Link>
            </Button>
          </div>
        ) : (
          <Table>
            <TableCaption className="sr-only">Recent clients</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Client Name</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col">Agents</TableHead>
                <TableHead scope="col">Last Run</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentClients.map((client) => (
                <TableRow key={client.tenantId}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/clients/${client.tenantId}`}
                      className="text-foreground hover:underline"
                    >
                      <span className="block max-w-[200px] truncate" title={client.businessName}>
                        {client.businessName}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={client.status} />
                  </TableCell>
                  <TableCell>{client.deployedAgentCount}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(client.lastRunAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
