"use client";

import React from "react";
import { Crown, MoreVertical, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AcademicTeamMember } from "../types";

interface StudentRosterListProps {
  teamId: string;
  members: AcademicTeamMember[];
  canManage?: boolean;
  onToggleLead?: (teamId: string, memberId: string, currentRole: "LEAD" | "MEMBER") => void;
  onRemoveStudent?: (teamId: string, memberId: string) => void;
  isRemoving?: boolean;
  emptyMessage?: string;
  maxHeight?: string;
}

export const StudentRosterList: React.FC<StudentRosterListProps> = ({
  teamId,
  members,
  canManage = false,
  onToggleLead,
  onRemoveStudent,
  isRemoving = false,
  emptyMessage = "No students joined yet. Share join code with students.",
  maxHeight = "max-h-36",
}) => {
  if (members.length === 0) {
    return (
      <div className="py-2.5 px-3 rounded-lg border border-dashed text-center bg-muted/20">
        <p className="text-[11px] text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${maxHeight} overflow-y-auto pr-1`}>
      {members.map((student) => {
        const isLead = student.role === "LEAD";
        const studentMemberId = student.member_id;

        return (
          <div
            key={student.id}
            className="flex items-center justify-between p-1.5 rounded-md bg-muted/30 border border-border/40 text-xs"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="size-6 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">
                {student.name ? student.name[0].toUpperCase() : "S"}
              </div>
              <div className="truncate">
                <p className="text-xs font-medium text-foreground truncate">
                  {student.name || student.email || "Student"}
                </p>
                {isLead && (
                  <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                    <Crown className="size-2.5" /> Team Lead
                  </span>
                )}
              </div>
            </div>

            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6 text-muted-foreground hover:text-foreground"
                  >
                    <MoreVertical className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-xs">
                  {onToggleLead && (
                    <DropdownMenuItem
                      onClick={() => onToggleLead(teamId, studentMemberId, student.role)}
                      className="gap-2 cursor-pointer font-medium"
                    >
                      <Crown className="size-3.5 text-amber-500" />
                      {isLead ? "Demote to Member" : "Promote to Team Lead"}
                    </DropdownMenuItem>
                  )}
                  {onRemoveStudent && (
                    <DropdownMenuItem
                      onClick={() => onRemoveStudent(teamId, studentMemberId)}
                      disabled={isRemoving}
                      className="gap-2 text-destructive cursor-pointer"
                    >
                      <UserMinus className="size-3.5" />
                      Remove from Group
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      })}
    </div>
  );
};

