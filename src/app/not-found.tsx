"use client";

import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFoundPage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-neutral-50 dark:bg-neutral-950">
      <div className="size-16 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center mb-4 text-blue-600">
        <Compass className="size-8" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
        404 - Page Not Found
      </h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-md">
        The page you are looking for doesn&apos;t exist or may have been moved.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button asChild size="default">
          <Link href="/">
            <ArrowLeft className="size-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
        <Button asChild variant="outline" size="default">
          <Link href="/workspaces/create">
            Workspaces
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFoundPage;
