"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

const ErrorPage = ({ reset }: { error?: Error; reset?: () => void }) => {
  return ( 
    <div className="h-screen flex flex-col gap-y-4 items-center justify-center p-4 text-center">
      <div className="size-12 rounded-full bg-rose-100 dark:bg-rose-950 flex items-center justify-center text-rose-600">
        <AlertTriangle className="size-6" />
      </div>
      <h2 className="text-xl font-bold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        An unexpected error occurred. You can retry or head back to the dashboard.
      </p>
      <div className="flex items-center gap-3">
        {reset && (
          <Button onClick={() => reset()} variant="primary" size="sm">
            Try again
          </Button>
        )}
        <Button asChild variant="outline" size="sm">
          <Link href="/">
            Back to home
          </Link>
        </Button>
      </div>
    </div>
   );
}
 
export default ErrorPage;
