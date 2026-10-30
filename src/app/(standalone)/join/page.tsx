import { redirect } from "next/navigation";
import { getCurrent } from "@/features/auth/queries";
import { DirectJoinCard } from "@/features/invite-links/components/direct-join-card";

interface JoinPageProps {
  searchParams: {
    code?: string;
  };
}

const JoinPage = async ({ searchParams }: JoinPageProps) => {
  const user = await getCurrent();
  if (!user) redirect("/sign-in");

  return <DirectJoinCard initialCode={searchParams?.code || ""} />;
};

export default JoinPage;

