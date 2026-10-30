import { redirect } from "next/navigation";
import { getCurrent } from "@/features/auth/queries";
import { CollegeClient } from "./client";

const CollegePage = async () => {
  const user = await getCurrent();
  if (!user) redirect("/sign-in");

  return <CollegeClient />;
};

export default CollegePage;

