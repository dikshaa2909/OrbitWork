import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getCurrent } from "@/features/auth/queries";
import { getWorkspaces } from "@/features/workspaces/queries";

export default async function Home() {
  const user = await getCurrent();
  if (!user) redirect("/sign-in");

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
