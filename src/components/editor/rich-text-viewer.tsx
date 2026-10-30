"use client";

import React from "react";

interface RichTextViewerProps {
  content?: string | null;
  className?: string;
}

export const RichTextViewer: React.FC<RichTextViewerProps> = ({
  content,
  className = "",
}) => {
  if (!content || !content.trim()) {
    return (
      <span className="text-muted-foreground italic text-sm">
        No content provided
      </span>
    );
  }

  // Check if content looks like HTML
  const isHtml = /<[a-z][\s\S]*>/i.test(content);

  if (isHtml) {
    return (
      <div
        className={`prose prose-sm dark:prose-invert max-w-none text-foreground break-words leading-relaxed [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-3 [&_blockquote]:italic [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-md [&_.mention]:text-primary [&_.mention]:font-semibold [&_.mention]:bg-primary/10 [&_.mention]:px-1 [&_.mention]:py-0.5 [&_.mention]:rounded ${className}`}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  // Plain text fallback (with line breaks preserved)
  return (
    <div
      className={`text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed ${className}`}
    >
      {content}
    </div>
  );
};

