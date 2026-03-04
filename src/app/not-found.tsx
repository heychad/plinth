import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center px-4">
      <p className="text-6xl font-bold text-primary mb-4">404</p>
      <h1 className="text-2xl font-semibold text-foreground mb-2">Page not found</h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        The page you are looking for does not exist or has been moved.
      </p>
      <Button asChild>
        <Link href="/">Go home</Link>
      </Button>
    </div>
  );
}
