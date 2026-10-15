import { redirect } from "next/navigation";

import { getCurrent } from "@/features/auth/queries";
import { OnboardingView } from "@/features/workspaces/components/onboarding-view";

const WorkspaceCreatePage = async () => {
  const user = await getCurrent();
  if (!user) redirect("/sign-in");

  return <OnboardingView />;
};
 
export default WorkspaceCreatePage;
