"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

type DraftReport = {
  _id: string;
  tenantBusinessName?: string;
  overallScore: number;
  coachName?: string;
  callNumber: number | "onboarding" | "bonus";
};

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : score >= 70
        ? "bg-amber-100 text-amber-800 border-amber-200"
        : "bg-red-100 text-red-800 border-red-200";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${color}`}
      role="status"
      aria-label={`Score: ${score}`}
    >
      {score}
    </span>
  );
}

function DraftReportsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

type DraftReportsProps = {
  reports?: DraftReport[];
  isLoading: boolean;
};

export function DraftReports({ reports, isLoading }: DraftReportsProps) {
  const draftReports = (reports ?? []).slice(0, 3);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Draft Reports</CardTitle>
        <Badge variant="secondary" className="text-xs">
          {isLoading ? "…" : draftReports.length} pending
        </Badge>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <DraftReportsSkeleton />
        ) : draftReports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <FileText className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No draft reports to review.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {draftReports.map((report) => (
              <div
                key={report._id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {report.tenantBusinessName ?? "Unknown Client"}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <ScoreBadge score={report.overallScore} />
                    {report.coachName && (
                      <span className="truncate text-xs text-muted-foreground">
                        {report.coachName}
                      </span>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/reports/${report._id}`}>Review</Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
