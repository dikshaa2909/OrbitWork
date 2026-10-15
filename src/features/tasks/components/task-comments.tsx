"use client";

import { useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { DottedSeparator } from "@/components/dotted-separator";

import { usePermissions } from "@/hooks/use-permissions";
import { useGetComments } from "../api/use-get-comments";
import { useCreateComment } from "../api/use-create-comment";

interface TaskCommentsProps {
  taskId: string;
}

export const TaskComments = ({ taskId }: TaskCommentsProps) => {
  const [content, setContent] = useState("");
  const { can, role } = usePermissions();
  const { data, isLoading } = useGetComments({ taskId });
  const { mutate: createComment, isPending } = useCreateComment();

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
    <div className="p-4 border rounded-lg bg-card">
      <div className="flex items-center gap-x-2">
        <MessageSquare className="size-5 text-muted-foreground" />
        <p className="text-lg font-semibold">Comments</p>
        <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium">
          {comments.length}
        </span>
      </div>
      <DottedSeparator className="my-4" />

      {/* Comment Input */}
      {can("comment") ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-y-2 mb-6">
          <Textarea
            placeholder="Add a comment or @mention a team member..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            disabled={isPending}
            className="resize-none text-sm"
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
          {can("comment")
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
              <div className="flex-1">
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
                <p className="text-sm text-foreground/90 mt-1 whitespace-pre-wrap">
                  {comment.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
