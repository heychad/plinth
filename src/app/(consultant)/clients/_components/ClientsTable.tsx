"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Pause,
  Pencil,
  Archive,
  Search,
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TenantSummary } from "../../../../../convex/dashboard";

function formatRelativeDate(timestamp: number | null): string {
  if (!timestamp) return "\u2014";
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  paused: "secondary",
  churned: "outline",
};

const statusLabel: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  churned: "Churned",
};

function SortIcon({ isSorted }: { isSorted: false | "asc" | "desc" }) {
  if (isSorted === "asc") return <ArrowUp className="ml-1 h-4 w-4" />;
  if (isSorted === "desc") return <ArrowDown className="ml-1 h-4 w-4" />;
  return <ArrowUpDown className="ml-1 h-4 w-4 opacity-50" />;
}

function getAriaSortValue(isSorted: false | "asc" | "desc"): "ascending" | "descending" | "none" {
  if (isSorted === "asc") return "ascending";
  if (isSorted === "desc") return "descending";
  return "none";
}

const columns: ColumnDef<TenantSummary>[] = [
  {
    accessorKey: "businessName",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="-ml-4 h-8 px-2"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Business Name
        <SortIcon isSorted={column.getIsSorted()} />
      </Button>
    ),
    cell: ({ row }) => (
      <Link
        href={`/clients/${row.original.tenantId}`}
        className="font-medium text-primary hover:underline truncate max-w-[200px] block"
        title={row.original.businessName}
      >
        {row.original.businessName}
      </Link>
    ),
  },
  {
    accessorKey: "ownerName",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="-ml-4 h-8 px-2"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Owner
        <SortIcon isSorted={column.getIsSorted()} />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.ownerName}</span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    enableSorting: false,
    cell: ({ row }) => (
      <Badge
        variant={statusVariant[row.original.status] ?? "outline"}
        role="status"
        aria-label={`Status: ${statusLabel[row.original.status] ?? row.original.status}`}
      >
        {statusLabel[row.original.status] ?? row.original.status}
      </Badge>
    ),
    filterFn: (row, _columnId, filterValue) => {
      if (!filterValue || filterValue === "all") return true;
      return row.original.status === filterValue;
    },
  },
  {
    accessorKey: "deployedAgentCount",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="-ml-4 h-8 px-2"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Agents
        <SortIcon isSorted={column.getIsSorted()} />
      </Button>
    ),
    cell: ({ row }) => (
      <Badge variant="secondary">{row.original.deployedAgentCount}</Badge>
    ),
  },
  {
    accessorKey: "lastRunAt",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="-ml-4 h-8 px-2"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Last Run
        <SortIcon isSorted={column.getIsSorted()} />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground whitespace-nowrap">
        {formatRelativeDate(row.original.lastRunAt)}
      </span>
    ),
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.lastRunAt ?? 0;
      const b = rowB.original.lastRunAt ?? 0;
      return a - b;
    },
  },
  {
    id: "actions",
    header: "Actions",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/clients/${row.original.tenantId}`}>View</Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
  },
];

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-5 w-[180px]" />
          <Skeleton className="h-5 w-[120px]" />
          <Skeleton className="h-5 w-[70px]" />
          <Skeleton className="h-5 w-[50px]" />
          <Skeleton className="h-5 w-[80px]" />
          <Skeleton className="h-5 w-[100px]" />
        </div>
      ))}
    </div>
  );
}

type ClientsTableProps = {
  data: TenantSummary[];
  isLoading: boolean;
  onAddClient: () => void;
};

export function ClientsTable({ data, isLoading, onAddClient }: ClientsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = (filterValue as string).toLowerCase();
      return (
        row.original.businessName.toLowerCase().includes(search) ||
        row.original.ownerName.toLowerCase().includes(search)
      );
    },
    initialState: {
      pagination: { pageSize: 25 },
    },
  });

  if (isLoading) {
    return <TableSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
            aria-label="Search clients"
          />
        </div>
        <div className="w-[160px]">
          <label className="sr-only" htmlFor="status-filter">
            Filter by status
          </label>
          <Select
            value={(table.getColumn("status")?.getFilterValue() as string) ?? "all"}
            onValueChange={(value) =>
              table.getColumn("status")?.setFilterValue(value === "all" ? undefined : value)
            }
          >
            <SelectTrigger id="status-filter">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="churned">Churned</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table or empty state */}
      {data.length === 0 && !globalFilter ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <p className="text-lg font-medium text-foreground">No clients yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first client to get started.
          </p>
          <Button className="mt-4" onClick={onAddClient}>
            Add client
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableCaption className="sr-only">Client list</TableCaption>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const isSorted = header.column.getIsSorted();
                      return (
                        <TableHead
                          key={header.id}
                          scope="col"
                          aria-sort={
                            header.column.getCanSort()
                              ? getAriaSortValue(isSorted)
                              : undefined
                          }
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No clients match your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {table.getPageCount() > 1 && (
            <div className="flex items-center justify-between px-2">
              <p className="text-sm text-muted-foreground">
                Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
                {"\u2013"}
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                  table.getFilteredRowModel().rows.length
                )}{" "}
                of {table.getFilteredRowModel().rows.length} clients
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
