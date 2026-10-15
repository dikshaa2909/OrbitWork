import { Query, type Databases } from "@/lib/supabase";

import { DATABASE_ID, MEMBERS_ID } from "@/config";
import { Member } from "./types";

interface GetMemberProps {
  databases: Databases;
  workspaceId: string;
  userId: string;
}

export const getMember = async ({
  databases,
  workspaceId,
  userId,
}: GetMemberProps): Promise<Member | undefined> => {
  const members = await databases.listDocuments<Member>(
    DATABASE_ID,
    MEMBERS_ID,
    [Query.equal("workspaceId", workspaceId), Query.equal("userId", userId)]
  );

  return members.documents[0];
};
