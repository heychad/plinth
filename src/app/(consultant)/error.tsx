"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ConsultantError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center px-4">
      <h1 className="text-2xl font-semibold text-foreground mb-2">Something went wrong</h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        An unexpected error occurred. Please try again.
      </p>
      <div className="flex gap-4">
        <Button variant="outline" onClick={() => window.location.href = "/"}>
          Go home
        </Button>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
