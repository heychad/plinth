"use client";

import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { TemplateCard, type TemplateData } from "./_components/TemplateCard";
import { DeployToClientDialog } from "./_components/DeployToClientDialog";

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "marketing", label: "Marketing" },
  { value: "sales", label: "Sales" },
  { value: "operations", label: "Operations" },
  { value: "coaching", label: "Coaching" },
] as const;

type CategoryFilter = (typeof CATEGORIES)[number]["value"];

function SkeletonCard() {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="flex-1 pb-3">
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-4/5" />
      </CardContent>
      <CardFooter className="pt-0">
        <Skeleton className="h-11 w-full rounded-md" />
      </CardFooter>
    </Card>
  );
}

export default function AgentTemplatesPage() {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [deployTemplate, setDeployTemplate] = useState<TemplateData | null>(null);

  const categoryArg = category === "all" ? undefined : category;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { results, status, loadMore } = usePaginatedQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).agentTemplates.listAgentTemplates,
    { category: categoryArg },
    { initialNumItems: 50 }
  );

  const isLoading = status === "LoadingFirstPage";
  const canLoadMore = status === "CanLoadMore";

  return (
    <main id="main-content" tabIndex={-1} className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-6">Agent Library</h1>

      <Tabs
        value={category}
        onValueChange={(v) => setCategory(v as CategoryFilter)}
        className="mb-6"
      >
        <TabsList>
          {CATEGORIES.map((cat) => (
            <TabsTrigger
              key={cat.value}
              value={cat.value}
              className="min-h-[44px] px-4"
            >
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-lg">
          <p className="text-muted-foreground">
            No agent templates available
            {category !== "all" ? ` in ${category}` : ""}.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {results.map((template: TemplateData) => (
              <TemplateCard
                key={template._id}
                template={template}
                onDeploy={setDeployTemplate}
              />
            ))}
          </div>

          {canLoadMore && (
            <div className="mt-8 text-center">
              <button
                onClick={() => loadMore(50)}
                className="px-6 py-2 text-sm font-medium text-primary hover:underline"
              >
                Load more
              </button>
            </div>
          )}
        </>
      )}

      <DeployToClientDialog
        template={deployTemplate}
        onClose={() => setDeployTemplate(null)}
      />
    </main>
  );
}
