import { Skeleton } from "@/components/ui/skeleton";

export default function ClientAppLoading() {
  return (
    <div className="flex h-full flex-col">
      {/* Message bubble skeletons */}
      <div className="flex-1 space-y-4 p-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-16 w-2/3 rounded-lg" />
        </div>
        <div className="flex items-start justify-end gap-3">
          <Skeleton className="h-12 w-1/2 rounded-lg" />
        </div>
        <div className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-20 w-3/4 rounded-lg" />
        </div>
      </div>
      {/* Input area skeleton */}
      <div className="border-t p-4">
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  );
}
