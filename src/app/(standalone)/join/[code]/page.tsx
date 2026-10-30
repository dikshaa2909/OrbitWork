import { redirect } from "next/navigation";
import { getCurrent } from "@/features/auth/queries";
import { DirectJoinCard } from "@/features/invite-links/components/direct-join-card";

interface JoinCodePageProps {
  params: {
    code: string;
  };
}

const JoinCodePage = async ({ params }: JoinCodePageProps) => {
  const user = await getCurrent();
  if (!user) redirect("/sign-in");

  return <DirectJoinCard initialCode={params.code} />;
};

export default JoinCodePage;

