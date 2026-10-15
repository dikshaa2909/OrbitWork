import { redirect } from "next/navigation";
import { getCurrent } from "@/features/auth/queries";
import { AccessRequestsPanel } from "@/features/access-requests/components/access-requests-panel";

const WorkspaceRequestsPage = async () => {
  const user = await getCurrent();
  if (!user) redirect("/sign-in");

  return (
    <div className="w-full max-w-4xl mx-auto py-4">
      <AccessRequestsPanel />
    </div>
  );
};

export default WorkspaceRequestsPage;
