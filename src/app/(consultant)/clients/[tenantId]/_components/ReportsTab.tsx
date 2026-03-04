"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Id } from "../../../../../../convex/_generated/dataModel";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
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

interface CoachingReport {
  _id: Id<"coachingCallReports">;
  coachName?: string;
  callNumber: number | "onboarding" | "bonus";
  overallScore: number;
  status: string;
  createdAt: number;
}

interface ReportsTabProps {
  tenantId: Id<"tenants">;
  reports: CoachingReport[];
}

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
    className: "bg-muted text-muted-foreground border-muted",
  },
};

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
  column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (desc?: boolean) => void };
}) {
  const sorted = column.getIsSorted();
  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(sorted === "asc")}
      className="h-8 px-2 -ml-2 font-semibold"
      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
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

export function ReportsTab({ tenantId, reports }: ReportsTabProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<CoachingReport>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: ({ column }) => <SortHeader label="Date" column={column} />,
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: "coachName",
        header: ({ column }) => <SortHeader label="Coach" column={column} />,
        cell: ({ row }) => (
          <span className="text-sm">{row.original.coachName ?? "\u2014"}</span>
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
            onClick={() =>
              router.push(`/reports/${row.original._id}`)
            }
          >
            <Eye className="mr-1.5 h-4 w-4" />
            Review
          </Button>
        ),
      },
    ],
    [router]
  );

  const table = useReactTable({
    data: reports,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">No reports yet for this client.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableCaption className="sr-only">
          Coaching call reports for this client
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
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
