"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2 } from "lucide-react";

import { DottedSeparator } from "@/components/dotted-separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useInviteCode } from "../hooks/use-invite-code";
import { useWorkspaceId } from "../hooks/use-workspace-id";
import { useJoinWorkspace } from "../api/use-join-workspace";
import { useLookupInviteLink } from "@/features/invite-links/api/use-lookup-invite-link";
import { useJoinInviteLink } from "@/features/invite-links/api/use-join-invite-link";

interface JoinWorkspaceFormProps {
  initialValues: {
    name: string;
  };
}

export const JoinWorkspaceForm = ({
  initialValues,
}: JoinWorkspaceFormProps) => {
  const router = useRouter();
  const workspaceId = useWorkspaceId();
  const inviteCode = useInviteCode();

  // Check if this is a role-bound invite link
  const { data: roleLinkData } = useLookupInviteLink({
    code: inviteCode || "",
  });

  const { mutate: joinStandard, isPending: isJoiningStandard } = useJoinWorkspace();
  const { mutate: joinRoleLink, isPending: isJoiningRoleLink } = useJoinInviteLink();

  const isPending = isJoiningStandard || isJoiningRoleLink;

  const onSubmit = () => {
    // If it's a role-bound link, use the role-bound join endpoint
    if (roleLinkData?.workspaceId) {
      joinRoleLink(
        { code: inviteCode },
        {
          onSuccess: (res) => {
            const wid = res?.data?.workspaceId || roleLinkData.workspaceId || workspaceId;
            router.push(`/workspaces/${wid}`);
          },
        }
      );
      return;
    }

    // Otherwise standard workspace join
    joinStandard(
      {
        param: { workspaceId },
        json: { code: inviteCode },
      },
      {
        onSuccess: ({ data }) => {
          router.push(`/workspaces/${data.$id}`);
        },
      }
    );
  };

  return (
    <Card className="w-full h-full border-none shadow-none">
      <CardHeader className="p-7">
        <CardTitle className="text-xl font-bold">
          Join Workspace
        </CardTitle>
        <CardDescription>
          You&apos;ve been invited to join <strong>{roleLinkData?.workspaceName || initialValues.name}</strong> workspace.
        </CardDescription>

        {roleLinkData?.roleName && (
          <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200">
            <ShieldCheck className="size-4 text-blue-600 shrink-0" />
            <div>
              Assigned Role: <Badge variant="secondary" className="font-bold uppercase text-[10px] ml-1">{roleLinkData.roleName}</Badge>
            </div>
          </div>
        )}
      </CardHeader>
      <div className="px-7">
        <DottedSeparator />
      </div>
      <CardContent className="p-7">
        <div className="flex flex-col lg:flex-row gap-2 items-center justify-between">
          <Button
            variant="secondary"
            type="button"
            asChild
            size="lg"
            className="w-full lg:w-fit"
            disabled={isPending}
          >
            <Link href="/">
              Cancel
            </Link>
          </Button>
          <Button
            size="lg"
            className="w-full lg:w-fit"
            type="button"
            onClick={onSubmit}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Joining...
              </>
            ) : roleLinkData?.roleName ? (
              `Join as ${roleLinkData.roleName}`
            ) : (
              "Join Workspace"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};