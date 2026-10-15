"use client";

// Lightweight React-compatible store (no zustand dependency needed)
import { useState, useEffect } from "react";

const LISTENERS = new Set<() => void>();
let currentPreviewRoleId: string | null = null;
let currentPreviewRoleName: string | null = null;

export function setPreviewRoleState(roleId: string | null, roleName?: string | null) {
  currentPreviewRoleId = roleId;
  currentPreviewRoleName = roleName || null;
  if (typeof window !== "undefined") {
    if (roleId) {
      sessionStorage.setItem("preview_role_id", roleId);
      if (roleName) sessionStorage.setItem("preview_role_name", roleName);
    } else {
      sessionStorage.removeItem("preview_role_id");
      sessionStorage.removeItem("preview_role_name");
    }
  }
  LISTENERS.forEach((l) => l());
}

export function usePreviewRole() {
  const [, setTick] = useState(0);

  useEffect(() => {
    // Initialize from sessionStorage once on mount
    if (typeof window !== "undefined" && currentPreviewRoleId === null) {
      const storedId = sessionStorage.getItem("preview_role_id");
      const storedName = sessionStorage.getItem("preview_role_name");
      if (storedId) {
        currentPreviewRoleId = storedId;
        currentPreviewRoleName = storedName;
        setTick((t) => t + 1);
      }
    }

    const listener = () => setTick((t) => t + 1);
    LISTENERS.add(listener);
    return () => {
      LISTENERS.delete(listener);
    };
  }, []);

  return {
    previewRoleId: currentPreviewRoleId,
    previewRoleName: currentPreviewRoleName,
    setPreviewRole: (roleId: string | null, roleName?: string | null) => setPreviewRoleState(roleId, roleName),
    clearPreviewRole: () => setPreviewRoleState(null, null),
  };
}
