"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { ArrowUpDown, ArrowUp, ArrowDown, Eye } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReportRow {
  _id: string;
  tenantId: string;
  tenantBusinessName?: string;
  coachId?: string;
  coachName?: string;
  studentId?: string;
  studentName?: string;
  callNumber: number | "onboarding" | "bonus";
  overallScore: number;
  status: string;
  flagged: boolean;
  createdAt: number;
  recordedAt?: number;
}

interface ReportsTableProps {
  reports: ReportRow[];
  isLoading: boolean;
}

// ─── Status config ───────────────────────────────────────────────────────────

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className: string }
> = {
  draft: {
    label: "Draft",
    variant: "secondary",
    className: "bg-muted text-muted-foreground border-muted",
  },
  reviewed: {
    label: "Reviewed",
    variant: "outline",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  sent: {
    label: "Sent",
    variant: "outline",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  no_action: {
    label: "No Action",
    variant: "secondary",
    className: "bg-muted/50 text-muted-foreground border-muted",
  },
};

// ─── Subcomponents ───────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  let className = "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (score < 70) {
    className = "bg-red-100 text-red-800 border-red-200";
  } else if (score < 80) {
    className = "bg-amber-100 text-amber-800 border-amber-200";
  }

  return (
    <Badge
      variant="outline"
      className={className}
      role="status"
      aria-label={`Score: ${score}`}
    >
      {score}
    </Badge>
  );
}

function SortHeader({
  label,
  column,
}: {
  label: string;
  column: {
    getIsSorted: () => false | "asc" | "desc";
    toggleSorting: (desc?: boolean) => void;
  };
}) {
  const sorted = column.getIsSorted();
  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(sorted === "asc")}
      className="h-8 px-2 -ml-2 font-semibold"
      aria-sort={
        sorted === "asc"
          ? "ascending"
          : sorted === "desc"
            ? "descending"
            : "none"
      }
    >
      {label}
      {sorted === "asc" ? (
        <ArrowUp className="ml-1 h-4 w-4" />
      ) : sorted === "desc" ? (
        <ArrowDown className="ml-1 h-4 w-4" />
      ) : (
        <ArrowUpDown className="ml-1 h-4 w-4" />
      )}
    </Button>
  );
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Skeleton loader ─────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-12" /></TableCell>
          <TableCell><Skeleton className="h-5 w-10" /></TableCell>
          <TableCell><Skeleton className="h-5 w-16" /></TableCell>
          <TableCell><Skeleton className="h-8 w-20" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ReportsTable({ reports, isLoading }: ReportsTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  // Client-side filtering
  const filteredData = useMemo(() => {
    let data = reports;

    if (statusFilter !== "all") {
      data = data.filter((r) => r.status === statusFilter);
    }

    if (scoreFilter === "high") {
      data = data.filter((r) => r.overallScore >= 80);
    } else if (scoreFilter === "medium") {
      data = data.filter((r) => r.overallScore >= 70 && r.overallScore < 80);
    } else if (scoreFilter === "low") {
      data = data.filter((r) => r.overallScore < 70);
    }

    if (flaggedOnly) {
      data = data.filter((r) => r.flagged);
    }

    return data;
  }, [reports, statusFilter, scoreFilter, flaggedOnly]);

  const columns = useMemo<ColumnDef<ReportRow>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: ({ column }) => <SortHeader label="Date" column={column} />,
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap">
            {formatDate(row.original.recordedAt ?? row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: "tenantBusinessName",
        header: ({ column }) => <SortHeader label="Client" column={column} />,
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.tenantBusinessName || "\u2014"}
          </span>
        ),
      },
      {
        accessorKey: "coachName",
        header: ({ column }) => <SortHeader label="Coach" column={column} />,
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.coachName || row.original.coachId || "\u2014"}
          </span>
        ),
      },
      {
        id: "studentName",
        accessorFn: (row) => row.studentName || row.studentId || "",
        header: () => <span className="text-sm font-semibold">Student</span>,
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.studentName || row.original.studentId || "\u2014"}
          </span>
        ),
      },
      {
        id: "callNumber",
        accessorFn: (row) => String(row.callNumber),
        header: () => <span className="text-sm font-semibold">Call #</span>,
        cell: ({ row }) => (
          <span className="text-sm">{String(row.original.callNumber)}</span>
        ),
      },
      {
        accessorKey: "overallScore",
        header: ({ column }) => <SortHeader label="Score" column={column} />,
        cell: ({ row }) => <ScoreBadge score={row.original.overallScore} />,
      },
      {
        accessorKey: "status",
        header: ({ column }) => <SortHeader label="Status" column={column} />,
        cell: ({ row }) => {
          const info = statusConfig[row.original.status] ?? {
            label: row.original.status,
            variant: "secondary" as const,
            className: "bg-muted text-muted-foreground border-muted",
          };
          return (
            <Badge
              variant={info.variant}
              className={info.className}
              role="status"
              aria-label={`Status: ${info.label}`}
            >
              {info.label}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px] min-w-[44px]"
            onClick={() => router.push(`/reports/${row.original._id}`)}
          >
            <Eye className="mr-1.5 h-4 w-4" />
            {row.original.status === "sent" ? "View" : "Review"}
          </Button>
        ),
      },
    ],
    [router]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="status-filter" className="text-xs font-semibold text-muted-foreground">
            Status
          </Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger id="status-filter" className="w-[140px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="no_action">No Action</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="score-filter" className="text-xs font-semibold text-muted-foreground">
            Score Range
          </Label>
          <Select value={scoreFilter} onValueChange={setScoreFilter}>
            <SelectTrigger id="score-filter" className="w-[160px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="high">High (&ge; 80)</SelectItem>
              <SelectItem value="medium">Medium (70&ndash;79)</SelectItem>
              <SelectItem value="low">Low (&lt; 70)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2 pb-0.5">
          <Checkbox
            id="flagged-filter"
            checked={flaggedOnly}
            onCheckedChange={(checked) => setFlaggedOnly(checked === true)}
          />
          <Label htmlFor="flagged-filter" className="text-sm cursor-pointer">
            Show flagged only
          </Label>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableCaption className="sr-only">
            Coaching call reports across all clients
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
            {isLoading ? (
              <SkeletonRows />
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No reports found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
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
