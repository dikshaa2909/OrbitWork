import { useQuery } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

interface UseLookupInviteLinkProps {
  code: string;
}

export const useLookupInviteLink = ({ code }: UseLookupInviteLinkProps) => {
  const query = useQuery({
    queryKey: ["invite-link", "lookup", code],
    queryFn: async () => {
      const response = await client.api["invite-links"]["lookup"].$get({
        query: { code },
      });

      if (!response.ok) {
        const err = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || "Invalid or expired invite link");
      }

      const { data } = await response.json();
      return data;
    },
    enabled: !!code,
    retry: false,
  });

  return query;
};
