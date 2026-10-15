"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, ArrowRight, Home } from "lucide-react";

import { useGetWorkspaces } from "@/features/workspaces/api/use-get-workspaces";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface WorkspaceFallbackScreenProps {
  title?: string;
  message?: string;
}

export const WorkspaceFallbackScreen = ({
  title = "Workspace Not Accessible",
  message = "You don't have access to this workspace, or it may have been deleted.",
}: WorkspaceFallbackScreenProps) => {
  const router = useRouter();
  const { data: workspaces, isLoading } = useGetWorkspaces();

  const availableWorkspaces = workspaces?.documents ?? [];
  const firstAvailableWorkspace = availableWorkspaces[0];

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-md border">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto size-12 rounded-full bg-amber-100 flex items-center justify-center mb-3">
            <AlertTriangle className="size-6 text-amber-600" />
          </div>
          <CardTitle className="text-xl font-bold">{title}</CardTitle>
          <CardDescription className="text-sm text-muted-foreground mt-1.5">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 flex flex-col gap-3">
          {!isLoading && firstAvailableWorkspace ? (
            <Button
              className="w-full"
              size="lg"
              onClick={() => {
                const targetId = firstAvailableWorkspace.$id || firstAvailableWorkspace.id;
                router.push(`/workspaces/${targetId}`);
              }}
            >
              Go to {firstAvailableWorkspace.name}
              <ArrowRight className="size-4 ml-2" />
            </Button>
          ) : null}

          <Button asChild variant="outline" size="lg" className="w-full">
            <Link href="/workspaces/create">
              <Plus className="size-4 mr-2" />
              Create or Join a Workspace
            </Link>
          </Button>

          <Button asChild variant="ghost" size="sm" className="w-full text-muted-foreground">
            <Link href="/">
              <Home className="size-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
