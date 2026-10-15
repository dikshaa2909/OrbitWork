import { redirect } from "next/navigation";
import { getCurrent } from "@/features/auth/queries";
import { TeamsClient } from "./client";

const TeamsPage = async () => {
  const user = await getCurrent();
  if (!user) redirect("/sign-in");

  return <TeamsClient />;
};

export default TeamsPage;
