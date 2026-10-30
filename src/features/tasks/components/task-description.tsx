"use client";

import { useState } from "react";
import { PencilIcon, XIcon } from "lucide-react";

import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";
import { DottedSeparator } from "@/components/dotted-separator";
import { RichTextViewer } from "@/components/editor/rich-text-viewer";

const RichTextEditor = dynamic(
  () =>
    import("@/components/editor/rich-text-editor").then(
      (mod) => mod.RichTextEditor
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-32 w-full bg-muted/20 border rounded-md animate-pulse p-4 text-xs text-muted-foreground flex items-center justify-center">
        Loading editor...
      </div>
    ),
  }
);

import { Task } from "../types";
import { useUpdateTask } from "../api/use-update-task";

interface TaskDescriptionProps {
  task: Task;
}

export const TaskDescription = ({ task }: TaskDescriptionProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(task.description || "");

  const { mutate, isPending } = useUpdateTask();

  const handleSave = () => {
    mutate(
      {
        json: { description: value },
        param: { taskId: task.$id || task.id },
      },
      {
        onSuccess: () => {
          setIsEditing(false);
        },
      }
    );
  };

  return (
    <div className="p-4 border rounded-lg bg-card text-card-foreground">
      <div className="flex items-center justify-between">
        <p className="text-lg font-semibold">Overview</p>
        <Button
          onClick={() => {
            if (isEditing) {
              setValue(task.description || "");
            }
            setIsEditing((prev) => !prev);
          }}
          size="sm"
          variant="secondary"
        >
          {isEditing ? (
            <XIcon className="size-4 mr-2" />
          ) : (
            <PencilIcon className="size-4 mr-2" />
          )}
          {isEditing ? "Cancel" : "Edit"}
        </Button>
      </div>
      <DottedSeparator className="my-4" />
      {isEditing ? (
        <div className="flex flex-col gap-y-4">
          <RichTextEditor
            placeholder="Add a detailed description or type '@' to mention a teammate..."
            value={value}
            onChange={setValue}
            disabled={isPending}
            minHeight="140px"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setValue(task.description || "");
                setIsEditing(false);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isPending}
            >
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      ) : (
        <RichTextViewer content={task.description} />
      )}
    </div>
  );
};
