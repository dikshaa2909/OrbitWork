import { redirect } from "next/navigation";
import { getCurrent } from "@/features/auth/queries";
import { RolesSettingsClient } from "./client";

const RolesSettingsPage = async () => {
  const user = await getCurrent();
  if (!user) redirect("/sign-in");

  return <RolesSettingsClient />;
};

export default RolesSettingsPage;
