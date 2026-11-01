"use client";

import { useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { DottedSeparator } from "@/components/dotted-separator";
import { RichTextViewer } from "@/components/editor/rich-text-viewer";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useCollegePersona } from "@/features/college/hooks/use-college-persona";

const RichTextEditor = dynamic(
  () =>
    import("@/components/editor/rich-text-editor").then(
      (mod) => mod.RichTextEditor
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-28 w-full bg-muted/20 border rounded-md animate-pulse p-4 text-xs text-muted-foreground flex items-center justify-center">
        Loading editor...
      </div>
    ),
  }
);

import { usePermissions } from "@/hooks/use-permissions";
import { useGetComments } from "../api/use-get-comments";
import { useCreateComment } from "../api/use-create-comment";

interface TaskCommentsProps {
  taskId: string;
}

export const TaskComments = ({ taskId }: TaskCommentsProps) => {
  const [content, setContent] = useState("");
  const workspaceId = useWorkspaceId();
  const { data: workspace } = useGetWorkspace({ workspaceId });
  const { can, canComment: canCommentFromPerms, role } = usePermissions(workspaceId);
  const { isHod, isGuide, isStudent, isTeamLead } = useCollegePersona(workspaceId);
  const { data, isLoading } = useGetComments({ taskId });
  const { mutate: createComment, isPending } = useCreateComment();

  const isCollege = workspace?.type === "COLLEGE";
  const isCollegeMember = isCollege && (isGuide || isHod || isStudent || isTeamLead);

  // Faculty Guide, HOD, Lead, Student or anyone with comment permission can write comments
  const canComment =
    canCommentFromPerms ||
    can("comments:create") ||
    can("tasks:comments.create") ||
    can("comment") ||
    isCollegeMember;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    createComment(
      { param: { taskId }, json: { taskId, content } },
      {
        onSuccess: () => {
          setContent("");
        },
      }
    );
  };

  const comments = data?.documents || [];

  return (
    <div className="p-4 border rounded-lg bg-card text-card-foreground">
      <div className="flex items-center gap-x-2">
        <MessageSquare className="size-5 text-muted-foreground" />
        <p className="text-lg font-semibold">Comments</p>
        <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium">
          {comments.length}
        </span>
      </div>
      <DottedSeparator className="my-4" />

      {/* Comment Input with Rich Text Editor */}
      {canComment ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-y-3 mb-6">
          <RichTextEditor
            placeholder="Add a comment or type '@' to mention a teammate..."
            value={content}
            onChange={setContent}
            disabled={isPending}
            minHeight="90px"
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={isPending || !content.trim()}
              className="flex items-center gap-x-1"
            >
              <Send className="size-3.5 mr-1" />
              {isPending ? "Posting..." : "Comment"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="mb-6 p-3 rounded-md bg-muted/40 border border-dashed text-xs text-muted-foreground text-center">
          You have read-only access ({role?.toLowerCase() || "guest"}). Commenting is disabled.
        </div>
      )}

      {/* Comments List */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {canComment
            ? "No comments yet. Start the conversation!"
            : "No comments on this task yet."}
        </p>
      ) : (
        <div className="flex flex-col gap-y-4">
          {comments.map((comment) => (
            <div
              key={comment.$id || comment.id}
              className="flex items-start gap-x-3 p-3 rounded-md bg-muted/40 hover:bg-muted/60 transition"
            >
              <MemberAvatar
                name={comment.author?.name || "Member"}
                className="size-8 mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    {comment.author?.name || "Member"}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {comment.$createdAt || comment.created_at
                      ? formatDistanceToNow(
                          new Date(comment.$createdAt || comment.created_at),
                          { addSuffix: true }
                        )
                      : ""}
                  </span>
                </div>
                <div className="mt-1">
                  <RichTextViewer content={comment.content} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
