import React from "react";
import { Loader } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

import { useGetMembers } from "@/features/members/api/use-get-members";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useCollegePersona } from "@/features/college/hooks/use-college-persona";
import { useGetStudentGroup } from "@/features/college/api/use-get-student-group";
import { CreateTaskForm } from "./create-task-form";

interface CreateTaskFormWrapperProps {
  onCancel: () => void;
}

export const CreateTaskFormWrapper = ({
  onCancel,
}: CreateTaskFormWrapperProps) => {
  const workspaceId = useWorkspaceId();

  const { data: workspace, isLoading: isLoadingWorkspace } = useGetWorkspace({ workspaceId });
  const { isStudent, isTeamLead, persona, team, isLoading: isLoadingPersona } = useCollegePersona(workspaceId);
  const { data: studentGroup, isLoading: isLoadingStudentGroup } = useGetStudentGroup({ workspaceId });
  const { data: projects, isLoading: isLoadingProjects } = useGetProjects({ workspaceId });
  const { data: members, isLoading: isLoadingMembers } = useGetMembers({ workspaceId });

  const isCollege = workspace?.type === "COLLEGE";
  const isCollegeStudent = isCollege && (isStudent || isTeamLead || persona === "STUDENT" || persona === "TEAM_LEAD");

  // Project options
  const defaultProjectId = studentGroup?.team?.project_id || team?.projectId || projects?.documents[0]?.$id;
  const collegeGroupTitle = studentGroup?.team ? `${studentGroup.team.team_code} - ${studentGroup.team.title}` : (team ? `${team.teamCode} - ${team.title}` : "Capstone Group");

  let projectOptions = projects?.documents.map((project) => ({
    id: project.$id,
    name: project.name,
    imageUrl: project.imageUrl,
  })) ?? [];

  if (isCollegeStudent && defaultProjectId && !projectOptions.some(p => p.id === defaultProjectId)) {
    projectOptions = [{ id: defaultProjectId, name: collegeGroupTitle, imageUrl: "" }, ...projectOptions];
  }

  // Member options: In College student mode, scope strictly to student teammates
  let memberOptions: { id: string; name: string }[] = [];
  if (isCollegeStudent && studentGroup?.roster && studentGroup.roster.length > 0) {
    memberOptions = studentGroup.roster.map((r) => ({
      id: r.memberId || r.id,
      name: r.name,
    }));
  } else {
    // Filter out faculty and admin for college workspaces, or standard Jira members
    memberOptions = (members?.documents ?? [])
      .filter((m) => {
        if (!isCollegeStudent) return true;
        const rName = (m.roleName || m.role || "").toLowerCase();
        return !rName.includes("admin") && !rName.includes("owner") && !rName.includes("guide") && !rName.includes("faculty");
      })
      .map((m) => ({
        id: m.$id,
        name: m.name,
      }));
  }

  const isLoading = isLoadingWorkspace || isLoadingPersona || (isCollegeStudent ? isLoadingStudentGroup : (isLoadingProjects || isLoadingMembers));

  if (isLoading) {
    return (
      <Card className="w-full h-[714px] border-none shadow-none">
        <CardContent className="flex items-center justify-center h-full">
          <Loader className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <CreateTaskForm
      onCancel={onCancel}
      projectOptions={projectOptions}
      memberOptions={memberOptions}
      isCollegeGroupMode={isCollegeStudent}
      collegeGroupTitle={collegeGroupTitle}
      defaultProjectId={defaultProjectId || undefined}
    />
  );
};
