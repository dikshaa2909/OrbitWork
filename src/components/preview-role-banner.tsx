"use client";

import React from "react";
import { Eye, X } from "lucide-react";
import { usePreviewRole } from "@/hooks/use-preview-role";
import { Button } from "@/components/ui/button";

export const PreviewRoleBanner = () => {
  const { previewRoleId, previewRoleName, clearPreviewRole } = usePreviewRole();

  if (!previewRoleId) {
    return null;
  }

  return (
    <div className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 py-2 flex items-center justify-between text-xs sm:text-sm font-medium shadow-md sticky top-0 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-x-2">
        <span className="p-1 bg-white/20 rounded-full flex items-center justify-center">
          <Eye className="size-4 text-white" />
        </span>
        <span>
          Preview mode active: viewing workspace as{" "}
          <strong className="underline underline-offset-2 uppercase tracking-wider font-bold">
            {previewRoleName || "Custom Role"}
          </strong>
          . Navigation and actions are limited by this role&apos;s permissions.
        </span>
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={clearPreviewRole}
        className="h-7 text-xs bg-white text-amber-900 hover:bg-neutral-100 font-semibold shadow-sm gap-x-1"
      >
        <X className="size-3.5" />
        Exit Preview
      </Button>
    </div>
  );
};
