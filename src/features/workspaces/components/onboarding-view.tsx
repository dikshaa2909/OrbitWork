"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Building2,
  Users2,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DottedSeparator } from "@/components/dotted-separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { client } from "@/lib/rpc";

import { WorkspaceAvatar } from "./workspace-avatar";
import { createWorkspaceSchema } from "../schemas";
import { useCreateWorkspace } from "../api/use-create-workspace";
import { useJoinWorkspace } from "../api/use-join-workspace";

interface WorkspacePreview {
  $id: string;
  name: string;
  imageUrl?: string;
  inviteCode: string;
  roleName?: string;
  isRoleBound?: boolean;
}

export const OnboardingView = () => {
  const router = useRouter();

  // Create Workspace Form
  const { mutate: createWorkspace, isPending: isCreating } = useCreateWorkspace();
  const form = useForm<z.infer<typeof createWorkspaceSchema>>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: {
      name: "",
    },
  });

  const onCreateSubmit = (values: z.infer<typeof createWorkspaceSchema>) => {
    createWorkspace(
      { form: values },
      {
        onSuccess: ({ data }) => {
          toast.success(`Workspace "${data.name}" created successfully!`);
          router.push(`/workspaces/${data.$id}`);
        },
        onError: (err) => {
          toast.error(err.message || "Failed to create workspace");
        },
      }
    );
  };

  // Join Workspace State
  const [inviteInput, setInviteInput] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [previewWorkspace, setPreviewWorkspace] = useState<WorkspacePreview | null>(null);
  const { mutate: joinWorkspace, isPending: isJoining } = useJoinWorkspace();

  const handleLookup = async (inputToTest?: string) => {
    const raw = (inputToTest !== undefined ? inputToTest : inviteInput).trim();
    if (!raw) {
      setLookupError("Please enter an invite code or link");
      setPreviewWorkspace(null);
      return;
    }

    setLookupError(null);
    setIsLookingUp(true);

    try {
      // Check if full URL was pasted (e.g. /workspaces/[id]/join/[code])
      const urlMatch = raw.match(/workspaces\/([^/]+)\/join\/([^/?&#]+)/);
      if (urlMatch) {
        const workspaceId = urlMatch[1];
        const code = urlMatch[2];

        // Fetch info
        const res = await client.api.workspaces[":workspaceId"]["info"].$get({
          param: { workspaceId },
        });

        if (res.ok) {
          const { data } = await res.json();
          setPreviewWorkspace({
            $id: workspaceId,
            name: data.name,
            imageUrl: data.imageUrl,
            inviteCode: code,
          });
          setIsLookingUp(false);
          return;
        }
      }

      // Lookup by invite code alone
      const cleanCode = raw.replace(/.*\/join\//, "").split("?")[0].trim();

      // Check role-bound link lookup first
      try {
        const roleRes = await client.api["invite-links"]["lookup"].$get({
          query: { code: cleanCode },
        });
        if (roleRes.ok) {
          const { data: roleLinkData } = await roleRes.json();
          if (roleLinkData?.workspaceId) {
            setPreviewWorkspace({
              $id: roleLinkData.workspaceId,
              name: roleLinkData.workspaceName,
              imageUrl: roleLinkData.workspaceImageUrl || undefined,
              inviteCode: cleanCode,
              roleName: roleLinkData.roleName || "VIEWER",
              isRoleBound: true,
            });
            setIsLookingUp(false);
            return;
          }
        }
      } catch {
        // Fall back to standard workspace lookup
      }

      const res = await client.api.workspaces["lookup-invite"].$get({
        query: { code: cleanCode },
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errData?.error || "Invalid or expired invite code");
      }

      const { data } = await res.json();
      setPreviewWorkspace({
        $id: data.$id || data.id,
        name: data.name,
        imageUrl: data.imageUrl,
        inviteCode: data.inviteCode,
        roleName: "MEMBER",
        isRoleBound: false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid or expired invite code";
      setLookupError(message);
      setPreviewWorkspace(null);
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleJoin = async () => {
    if (!previewWorkspace) return;

    if (previewWorkspace.isRoleBound) {
      try {
        const joinRes = await client.api["invite-links"]["join"].$post({
          json: { code: previewWorkspace.inviteCode },
        });
        if (!joinRes.ok) {
          const errData = (await joinRes.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errData?.error || "Failed to join workspace");
        }
        const resData = await joinRes.json();
        toast.success(`Welcome to ${previewWorkspace.name}! Joined successfully.`);
        router.push(`/workspaces/${resData.data.workspaceId || previewWorkspace.$id}`);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to join workspace");
      }
      return;
    }

    joinWorkspace(
      {
        param: { workspaceId: previewWorkspace.$id },
        json: { code: previewWorkspace.inviteCode },
      },
      {
        onSuccess: ({ data }) => {
          toast.success(`Welcome to ${data.name}! Joined successfully.`);
          router.push(`/workspaces/${data.$id}`);
        },
        onError: (err) => {
          toast.error(err.message || "Failed to join workspace");
        },
      }
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100">
          Welcome to your project hub
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          Start fresh with your own workspace or connect with your existing team using an invite link.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Card 1: Create a workspace */}
        <Card className="flex flex-col h-full border border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition">
          <CardHeader className="p-6 pb-4">
            <div className="size-10 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center mb-3">
              <Building2 className="size-5" />
            </div>
            <CardTitle className="text-xl font-bold">Create a workspace</CardTitle>
            <CardDescription>
              Create a dedicated workspace for your company, team, or personal projects.
            </CardDescription>
          </CardHeader>
          <div className="px-6">
            <DottedSeparator />
          </div>
          <CardContent className="p-6 flex-1 flex flex-col justify-between">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onCreateSubmit)} className="space-y-4 flex-1 flex flex-col justify-between">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Workspace Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g. Acme Engineering, Design Ops"
                          disabled={isCreating}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  size="lg"
                  className="w-full mt-4"
                  disabled={isCreating || !form.watch("name")?.trim()}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create Workspace
                      <ArrowRight className="size-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Card 2: Join a workspace */}
        <Card className="flex flex-col h-full border border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition">
          <CardHeader className="p-6 pb-4">
            <div className="size-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mb-3">
              <Users2 className="size-5" />
            </div>
            <CardTitle className="text-xl font-bold">Join a workspace</CardTitle>
            <CardDescription>
              Have an invitation code or link from your team administrator? Paste it below.
            </CardDescription>
          </CardHeader>
          <div className="px-6">
            <DottedSeparator />
          </div>
          <CardContent className="p-6 flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-3 flex-1">
              <label className="text-sm font-medium leading-none text-neutral-800 dark:text-neutral-200">
                Invite code or link
              </label>
              <div className="flex gap-2">
                <Input
                  value={inviteInput}
                  onChange={(e) => {
                    setInviteInput(e.target.value);
                    setLookupError(null);
                    setPreviewWorkspace(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleLookup();
                    }
                  }}
                  placeholder="Paste link or code (e.g. 6ZJV7N)"
                  disabled={isLookingUp || isJoining}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleLookup()}
                  disabled={isLookingUp || !inviteInput.trim()}
                >
                  {isLookingUp ? <Loader2 className="size-4 animate-spin" /> : "Lookup"}
                </Button>
              </div>

              {lookupError && (
                <div className="flex items-center gap-2 p-3 text-xs rounded-md bg-destructive/10 text-destructive border border-destructive/20">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{lookupError}</span>
                </div>
              )}

              {previewWorkspace && (
                <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 space-y-2 mt-4 animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <WorkspaceAvatar
                      name={previewWorkspace.name}
                      image={previewWorkspace.imageUrl}
                      className="size-10"
                    />
                    <div>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {previewWorkspace.name}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="size-3 text-emerald-600 inline" />
                        Valid invite code confirmed
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-500 pt-1">
                    You will join this workspace as <strong>{previewWorkspace.roleName || "MEMBER"}</strong>.
                  </p>
                </div>
              )}
            </div>

            <Button
              type="button"
              size="lg"
              className="w-full"
              variant={previewWorkspace ? "primary" : "secondary"}
              disabled={!previewWorkspace || isJoining}
              onClick={handleJoin}
            >
              {isJoining ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Joining Workspace...
                </>
              ) : (
                <>
                  Confirm & Join Workspace
                  <ArrowRight className="size-4 ml-2" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
