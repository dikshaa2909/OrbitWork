import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getCurrent } from "@/features/auth/queries";
import { getWorkspaces } from "@/features/workspaces/queries";
import { LandingView } from "@/components/landing/landing-view";

export default async function HomePage() {
  const user = await getCurrent();

  // If user is authenticated, route directly into their active workspace dashboard
  if (user) {
    const workspaces = await getWorkspaces();
    if (workspaces.total === 0) {
      redirect("/workspaces/create");
    }

    const cookieStore = cookies();
    const lastWorkspaceId = cookieStore.get("jira_last_workspace_id")?.value;

    const targetWorkspace = workspaces.documents.find(
      (w) => w.$id === lastWorkspaceId || w.id === lastWorkspaceId
    );

    if (targetWorkspace) {
      redirect(`/workspaces/${targetWorkspace.$id || targetWorkspace.id}`);
    }

    redirect(`/workspaces/${workspaces.documents[0].$id || workspaces.documents[0].id}`);
  }

  // If unauthenticated, render the high-polish SaaS landing page
  return <LandingView />;
}

