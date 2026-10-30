"use client";

import React, { useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import tippy, { Instance as TippyInstance } from "tippy.js";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Code2,
  Heading1,
  Heading2,
  Undo,
  Redo,
} from "lucide-react";

import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { MentionList, MentionItem } from "./mention-list";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: string;
  className?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = "Write something or type '@' to mention...",
  disabled = false,
  minHeight = "120px",
  className = "",
}) => {
  const workspaceId = useWorkspaceId();
  const { data: membersData } = useGetMembers({
    workspaceId: workspaceId || "",
  });

  const memberList: MentionItem[] = useMemo(() => {
    return (membersData?.documents || []).map((m) => ({
      id: (m.$id || m.id) as string,
      name: m.name || m.email || "Member",
      email: m.email || "",
    }));
  }, [membersData]);

  const mentionSuggestion = useMemo(() => {
    return {
      items: ({ query }: { query: string }) => {
        return memberList
          .filter(
            (item) =>
              item.name.toLowerCase().includes(query.toLowerCase()) ||
              item.email.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 5);
      },
      render: () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let component: ReactRenderer<any> | null = null;
        let popup: TippyInstance[] | null = null;

        return {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onStart: (props: any) => {
            component = new ReactRenderer(MentionList, {
              props,
              editor: props.editor,
            });

            if (!props.clientRect) return;

            popup = tippy("body", {
              getReferenceClientRect: props.clientRect,
              appendTo: () => document.body,
              content: component.element,
              showOnCreate: true,
              interactive: true,
              trigger: "manual",
              placement: "bottom-start",
            });
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onUpdate(props: any) {
            component?.updateProps(props);

            if (!props.clientRect) return;

            popup?.[0]?.setProps({
              getReferenceClientRect: props.clientRect,
            });
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onKeyDown(props: any) {
            if (props.event.key === "Escape") {
              popup?.[0]?.hide();
              return true;
            }

            return component?.ref?.onKeyDown(props);
          },
          onExit() {
            popup?.[0]?.destroy();
            component?.destroy();
          },
        };
      },
    };
  }, [memberList]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Mention.configure({
        HTMLAttributes: {
          class:
            "mention font-semibold text-primary bg-primary/10 px-1 py-0.5 rounded",
        },
        suggestion: mentionSuggestion,
      }),
    ],
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // If it's just an empty paragraph, send empty string
      if (html === "<p></p>") {
        onChange("");
      } else {
        onChange(html);
      }
    },
  });

  if (!editor) {
    return (
      <div
        className="w-full rounded-md border border-input bg-background p-3 text-sm text-muted-foreground animate-pulse"
        style={{ minHeight }}
      >
        Loading editor...
      </div>
    );
  }

  return (
    <div
      className={`rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 transition-all flex flex-col ${
        disabled ? "opacity-50 pointer-events-none" : ""
      } ${className}`}
    >
      {/* Top Formatting Mini-Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b bg-muted/30 text-muted-foreground rounded-t-md">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground text-xs ${
            editor.isActive("bold") ? "bg-muted text-foreground font-bold" : ""
          }`}
          title="Bold (Cmd+B)"
        >
          <Bold className="size-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground text-xs ${
            editor.isActive("italic")
              ? "bg-muted text-foreground italic"
              : ""
          }`}
          title="Italic (Cmd+I)"
        >
          <Italic className="size-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground text-xs ${
            editor.isActive("strike") ? "bg-muted text-foreground line-through" : ""
          }`}
          title="Strikethrough"
        >
          <Strikethrough className="size-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          disabled={!editor.can().chain().focus().toggleCode().run()}
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground text-xs ${
            editor.isActive("code") ? "bg-muted text-foreground font-mono" : ""
          }`}
          title="Inline Code"
        >
          <Code className="size-3.5" />
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        <button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground text-xs ${
            editor.isActive("heading", { level: 1 })
              ? "bg-muted text-foreground font-bold"
              : ""
          }`}
          title="Heading 1"
        >
          <Heading1 className="size-3.5" />
        </button>

        <button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground text-xs ${
            editor.isActive("heading", { level: 2 })
              ? "bg-muted text-foreground font-bold"
              : ""
          }`}
          title="Heading 2"
        >
          <Heading2 className="size-3.5" />
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground text-xs ${
            editor.isActive("bulletList")
              ? "bg-muted text-foreground"
              : ""
          }`}
          title="Bullet List"
        >
          <List className="size-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground text-xs ${
            editor.isActive("orderedList")
              ? "bg-muted text-foreground"
              : ""
          }`}
          title="Numbered List"
        >
          <ListOrdered className="size-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground text-xs ${
            editor.isActive("blockquote")
              ? "bg-muted text-foreground"
              : ""
          }`}
          title="Quote"
        >
          <Quote className="size-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-1.5 rounded hover:bg-muted hover:text-foreground text-xs ${
            editor.isActive("codeBlock")
              ? "bg-muted text-foreground"
              : ""
          }`}
          title="Code Block"
        >
          <Code2 className="size-3.5" />
        </button>

        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().chain().focus().undo().run()}
            className="p-1.5 rounded hover:bg-muted hover:text-foreground disabled:opacity-30 text-xs"
            title="Undo"
          >
            <Undo className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().chain().focus().redo().run()}
            className="p-1.5 rounded hover:bg-muted hover:text-foreground disabled:opacity-30 text-xs"
            title="Redo"
          >
            <Redo className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Editor Content Surface */}
      <EditorContent
        editor={editor}
        className="p-3 text-sm focus:outline-none flex-1 overflow-y-auto [&_.ProseMirror]:min-h-[100px] [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0"
        style={{ minHeight }}
      />
    </div>
  );
};
