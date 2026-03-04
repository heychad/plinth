"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Id } from "../../../../../../convex/_generated/dataModel";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Activity,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// --- types ---

interface AgentRun {
  _id: Id<"agentRuns">;
  agentDisplayName: string;
  status: string;
  triggerType: string;
  durationMs?: number;
  totalCostUsd: number;
  createdAt: number;
}

interface AgentConfig {
  _id: Id<"agentConfigs">;
  displayName: string;
}

interface RunHistoryTabProps {
  tenantId: Id<"tenants">;
  recentRuns: AgentRun[];
  agentConfigs: AgentConfig[];
}

// --- helpers ---

const runStatusVariant: Record<string, { label: string; className: string }> = {
  queued: {
    label: "Queued",
    className: "bg-muted text-muted-foreground border-muted",
  },
  running: {
    label: "Running",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  completed: {
    label: "Completed",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  failed: {
    label: "Failed",
    className: "bg-red-100 text-red-800 border-red-200",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-muted text-muted-foreground border-muted",
  },
};

function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return "\u2014";
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m ${rem}s`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function SortIcon({ isSorted }: { isSorted: false | "asc" | "desc" }) {
  if (isSorted === "asc") return <ArrowUp className="ml-1 h-3.5 w-3.5" />;
  if (isSorted === "desc") return <ArrowDown className="ml-1 h-3.5 w-3.5" />;
  return <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-50" />;
}

// --- main component ---

export function RunHistoryTab({
  tenantId,
  recentRuns,
  agentConfigs,
}: RunHistoryTabProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Unique agent names for filter dropdown
  const agentNames = useMemo(() => {
    const names = new Set(agentConfigs.map((c) => c.displayName));
    return Array.from(names).sort();
  }, [agentConfigs]);

  const columns = useMemo<ColumnDef<AgentRun>[]>(
    () => [
      {
        accessorKey: "agentDisplayName",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Agent
            <SortIcon isSorted={column.getIsSorted()} />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.getValue("agentDisplayName")}</span>
        ),
        filterFn: "equals",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.getValue("status") as string;
          const info = runStatusVariant[status] ?? {
            label: status,
            className: "bg-muted text-muted-foreground border-muted",
          };
          return (
            <Badge
              role="status"
              aria-label={`Status: ${info.label}`}
              variant="outline"
              className={info.className}
            >
              {info.label}
            </Badge>
          );
        },
      },
      {
        accessorKey: "triggerType",
        header: "Triggered",
        cell: ({ row }) => (
          <span className="text-muted-foreground capitalize">
            {row.getValue("triggerType")}
          </span>
        ),
      },
      {
        accessorKey: "durationMs",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Duration
            <SortIcon isSorted={column.getIsSorted()} />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDuration(row.getValue("durationMs"))}
          </span>
        ),
      },
      {
        accessorKey: "totalCostUsd",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Cost
            <SortIcon isSorted={column.getIsSorted()} />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            ${(row.getValue("totalCostUsd") as number).toFixed(4)}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Started
            <SortIcon isSorted={column.getIsSorted()} />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground whitespace-nowrap">
            {formatDate(row.getValue("createdAt"))}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 min-w-[44px]"
            onClick={() =>
              router.push(`/clients/${tenantId}/runs/${row.original._id}`)
            }
          >
            <Eye className="mr-1.5 h-4 w-4" />
            View
          </Button>
        ),
      },
    ],
    [tenantId, router]
  );

  const table = useReactTable({
    data: recentRuns,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (recentRuns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-lg">
        <Activity className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-semibold mb-1">No runs yet</p>
        <p className="text-sm text-muted-foreground">
          Runs will appear here once agents are triggered.
        </p>
      </div>
    );
  }

  const currentFilter =
    (table.getColumn("agentDisplayName")?.getFilterValue() as string) ?? "";

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h3 className="text-base font-semibold">Run History</h3>
        {agentNames.length > 1 && (
          <Select
            value={currentFilter}
            onValueChange={(value) =>
              table
                .getColumn("agentDisplayName")
                ?.setFilterValue(value === "all" ? "" : value)
            }
          >
            <SelectTrigger className="w-[200px] min-h-[44px]">
              <SelectValue placeholder="Filter by agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {agentNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableCaption className="sr-only">
            Run history for this client
          </TableCaption>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} scope="col">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-8 text-muted-foreground"
                >
                  No runs match the selected filter.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(
                      `/clients/${tenantId}/runs/${row.original._id}`
                    )
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
