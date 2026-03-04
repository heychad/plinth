"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Bot, Activity, DollarSign } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type StatCardData = {
  title: string;
  value: string | number;
  icon: LucideIcon;
};

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16" />
      </CardContent>
    </Card>
  );
}

function StatCardItem({ title, value, icon: Icon }: StatCardData) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

type StatCardsProps = {
  stats?: {
    activeClientCount: number;
    totalAgentsDeployed: number;
    flaggedReportCount: number;
    monthlyCostUsd: number;
  };
  isLoading: boolean;
};

export function StatCards({ stats, isLoading }: StatCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const cards: StatCardData[] = [
    {
      title: "Total Clients",
      value: stats?.activeClientCount ?? 0,
      icon: Users,
    },
    {
      title: "Active Agents",
      value: stats?.totalAgentsDeployed ?? 0,
      icon: Bot,
    },
    {
      title: "Runs This Month",
      value: stats?.flaggedReportCount ?? 0,
      icon: Activity,
    },
    {
      title: "Cost This Month",
      value: `$${(stats?.monthlyCostUsd ?? 0).toFixed(2)}`,
      icon: DollarSign,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <StatCardItem key={card.title} {...card} />
      ))}
    </div>
  );
}
