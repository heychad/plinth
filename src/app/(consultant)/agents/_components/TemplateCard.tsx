"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";

const categoryVariants: Record<string, string> = {
  marketing: "bg-purple-100 text-purple-800",
  sales: "bg-blue-100 text-blue-800",
  operations: "bg-orange-100 text-orange-800",
  coaching: "bg-green-100 text-green-800",
  general: "bg-gray-100 text-gray-700",
};

export type TemplateData = {
  _id: string;
  displayName: string;
  category: string;
  description: string;
  isActive: boolean;
  isPipeline: boolean;
};

type TemplateCardProps = {
  template: TemplateData;
  onDeploy: (template: TemplateData) => void;
};

export function TemplateCard({ template, onDeploy }: TemplateCardProps) {
  const catClass = categoryVariants[template.category] ?? "bg-gray-100 text-gray-700";

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg font-semibold leading-tight">
            {template.displayName}
          </CardTitle>
          <Badge variant="secondary" className={`shrink-0 text-xs uppercase ${catClass}`}>
            {template.category}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pb-3">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {template.description}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {template.isActive && (
            <Badge role="status" aria-label="Active" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
              Active
            </Badge>
          )}
          {template.isPipeline && (
            <Badge role="status" aria-label="Pipeline" className="bg-amber-100 text-amber-800 hover:bg-amber-100">
              Pipeline
            </Badge>
          )}
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Button
          className="w-full min-h-[44px]"
          onClick={() => onDeploy(template)}
        >
          <Rocket className="mr-2 h-4 w-4" />
          Deploy to client
        </Button>
      </CardFooter>
    </Card>
  );
}
