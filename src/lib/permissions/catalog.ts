/**
 * Granular Permissions Catalog
 * Grouped by category with descriptions, hierarchy levels, and default role mappings.
 */

export interface PermissionDefinition {
  key: string;
  category: PermissionCategory;
  name: string;
  description: string;
}

export type PermissionCategory =
  | "workspace"
  | "members"
  | "roles"
  | "projects"
  | "tasks"
  | "sprints"
  | "comments"
  | "reports"
  | "time"
  | "teams"
  | "requests"
  | "invites"
  | "chat"
  | "ai"
  | "audit";

export const PERMISSION_CATEGORIES: { id: PermissionCategory; name: string; description: string }[] = [
  { id: "workspace", name: "Workspace", description: "Workspace-level configuration and lifecycle" },
  { id: "members", name: "Members", description: "Member invitations, removal, and role assignment" },
  { id: "roles", name: "Roles & Permissions", description: "Custom role creation and permission management" },
  { id: "projects", name: "Projects", description: "Project creation, settings, and project membership" },
  { id: "tasks", name: "Tasks", description: "Task creation, view limits, editing, and workflow transitions" },
  { id: "sprints", name: "Sprints", description: "Sprint planning, starting, completing, and deletion" },
  { id: "comments", name: "Comments", description: "Task commenting and comment moderation" },
  { id: "reports", name: "Reports & Analytics", description: "Viewing reports and exporting project metrics" },
  { id: "time", name: "Time & Attendance", description: "Logging work, timesheet approvals, and attendance" },
  { id: "teams", name: "Teams", description: "Team creation, hierarchy management, and team membership" },
  { id: "requests", name: "Access Requests", description: "Reviewing and approving permission requests" },
  { id: "invites", name: "Invite Links", description: "Creating and managing role-bound workspace invite links" },
  { id: "chat", name: "Team Chat", description: "Channel creation, moderation, and messaging" },
  { id: "ai", name: "AI Assistant", description: "Access to AI tools and task summaries" },
  { id: "audit", name: "Audit Logs", description: "Viewing security and permission change logs" },
];

export const PERMISSIONS_CATALOG: PermissionDefinition[] = [
  // Workspace
  { key: "workspace:settings.edit", category: "workspace", name: "Edit Workspace Settings", description: "Update workspace name, image, and preferences" },
  { key: "workspace:delete", category: "workspace", name: "Delete Workspace", description: "Permanently delete the entire workspace and all data (Owner only)" },
  { key: "workspace:invite_code.manage", category: "workspace", name: "Manage Invite Links", description: "Reset or disable workspace invitation links" },

  // Members
  { key: "members:invite", category: "members", name: "Invite Members", description: "Send email invitations and copy workspace invite links" },
  { key: "members:remove", category: "members", name: "Remove Members", description: "Remove members from the workspace" },
  { key: "members:roles.assign", category: "members", name: "Assign Roles", description: "Change member roles up to the actor's own hierarchy level" },
  { key: "members:view", category: "members", name: "View Members List", description: "See other members in the workspace and their roles" },

  // Roles
  { key: "roles:manage", category: "roles", name: "Manage Custom Roles", description: "Create, edit, clone, and delete custom roles" },
  { key: "roles:create", category: "roles", name: "Create Roles", description: "Create new custom roles (subject to delegation limit)" },
  { key: "roles:grant", category: "roles", name: "Grant Role Permissions", description: "Grant permissions to roles within the actor's own permission set" },

  // Teams
  { key: "teams:manage", category: "teams", name: "Manage Teams", description: "Create, edit, delete teams and manage team membership" },

  // Requests & Invites
  { key: "requests:review", category: "requests", name: "Review Access Requests", description: "See, approve, or deny permission requests from members" },
  { key: "invites:manage", category: "invites", name: "Manage Invite Links", description: "Create role-bound invite links with expiry and max-use limits" },

  // Projects
  { key: "projects:create", category: "projects", name: "Create Projects", description: "Create new projects within the workspace" },
  { key: "projects:edit", category: "projects", name: "Edit Projects", description: "Update project name, image, and metadata" },
  { key: "projects:delete", category: "projects", name: "Delete Projects", description: "Permanently delete projects and their associated tasks" },
  { key: "projects:settings.manage", category: "projects", name: "Manage Project Settings", description: "Configure project workflow and defaults" },
  { key: "projects:members.manage", category: "projects", name: "Manage Project Members", description: "Assign project-level roles and membership overrides" },

  // Tasks
  { key: "tasks:create", category: "tasks", name: "Create Tasks", description: "Create new tasks and issues" },
  { key: "tasks:view.all", category: "tasks", name: "View All Tasks", description: "View all tasks in visible projects" },
  { key: "tasks:view.assigned_only", category: "tasks", name: "View Assigned Tasks Only", description: "Restricted to only see tasks assigned to self" },
  { key: "tasks:edit.any", category: "tasks", name: "Edit Any Task", description: "Edit any task in accessible projects" },
  { key: "tasks:edit.own", category: "tasks", name: "Edit Own / Assigned Tasks", description: "Edit tasks reported by or assigned to self" },
  { key: "tasks:delete.any", category: "tasks", name: "Delete Any Task", description: "Delete any task in accessible projects" },
  { key: "tasks:delete.own", category: "tasks", name: "Delete Own Tasks", description: "Delete tasks created by self (reporter)" },
  { key: "tasks:assign", category: "tasks", name: "Assign Tasks", description: "Assign or reassign tasks to team members" },
  { key: "tasks:transition", category: "tasks", name: "Transition Status", description: "Move tasks across workflow statuses or Kanban columns" },
  { key: "tasks:bulk_edit", category: "tasks", name: "Bulk Edit Tasks", description: "Perform batch actions or reordering on multiple tasks" },

  // Sprints
  { key: "sprints:manage", category: "sprints", name: "Manage Sprints", description: "Create, start, complete, and delete sprint cycles" },

  // Comments
  { key: "comments:create", category: "comments", name: "Add Comments", description: "Post comments and discussion messages on tasks" },
  { key: "comments:delete.any", category: "comments", name: "Delete Any Comment", description: "Moderate and remove comments by other members" },
  { key: "comments:delete.own", category: "comments", name: "Delete Own Comments", description: "Delete comments written by self" },

  // Reports
  { key: "reports:view", category: "reports", name: "View Reports", description: "Access analytics dashboards and velocity charts" },
  { key: "reports:export", category: "reports", name: "Export Reports", description: "Export task data and audit metrics to CSV or PDF" },

  // Time & WFH
  { key: "time:log_own", category: "time", name: "Log Work Time", description: "Log time spent on tasks" },
  { key: "time:view_team", category: "time", name: "View Team Time", description: "View work logs of direct reports and team members" },
  { key: "time:view_all", category: "time", name: "View All Time Logs", description: "View workspace-wide timesheets" },
  { key: "time:approve_timesheets", category: "time", name: "Approve Timesheets", description: "Approve or reject submitted team timesheets" },

  // Chat
  { key: "chat:channels.create", category: "chat", name: "Create Channels", description: "Create public and private team chat channels" },
  { key: "chat:channels.moderate", category: "chat", name: "Moderate Channels", description: "Delete inappropriate messages and manage channel members" },
  { key: "chat:dm", category: "chat", name: "Direct Messaging", description: "Send 1-on-1 and group direct messages" },

  // AI
  { key: "ai:use", category: "ai", name: "Use AI Assistant", description: "Generate task summaries, breakdown requirements, and use AI features" },

  // Audit
  { key: "audit:view", category: "audit", name: "View Audit Logs", description: "Inspect role modifications and permission change history" },
];

/**
 * Standard hierarchy levels: lower number = higher privilege.
 * Actor cannot modify roles with level <= actor.level (no privilege escalation).
 */
export const HIERARCHY_LEVELS = {
  OWNER: 0,
  ADMIN: 10,
  PROJECT_MANAGER: 20,
  TEAM_LEAD: 25,
  MEMBER: 30,
  VIEWER: 40,
  CLIENT: 45,
  GUEST: 50,
} as const;

/**
 * Default System Role Templates
 */
export interface SystemRoleTemplate {
  name: string;
  description: string;
  color: string;
  level: number;
  isSystem: boolean;
  permissions: string[];
}

export const SYSTEM_ROLE_TEMPLATES: Record<string, SystemRoleTemplate> = {
  OWNER: {
    name: "Owner",
    description: "Workspace owner with absolute control over all settings, billing, and data.",
    color: "#e11d48", // Rose 600
    level: HIERARCHY_LEVELS.OWNER,
    isSystem: true,
    permissions: PERMISSIONS_CATALOG.map((p) => p.key), // All permissions
  },
  ADMIN: {
    name: "Admin",
    description: "Workspace administrator who can manage members, projects, roles, and settings.",
    color: "#7c3aed", // Violet 600
    level: HIERARCHY_LEVELS.ADMIN,
    isSystem: true,
    permissions: PERMISSIONS_CATALOG.filter((p) => p.key !== "workspace:delete").map((p) => p.key),
  },
  PROJECT_MANAGER: {
    name: "Project Manager",
    description: "Manages projects, sprints, backlog, task assignments, and reporting.",
    color: "#2563eb", // Blue 600
    level: HIERARCHY_LEVELS.PROJECT_MANAGER,
    isSystem: true,
    permissions: [
      "members:view",
      "projects:create",
      "projects:edit",
      "projects:settings.manage",
      "projects:members.manage",
      "tasks:create",
      "tasks:view.all",
      "tasks:edit.any",
      "tasks:delete.any",
      "tasks:assign",
      "tasks:transition",
      "tasks:bulk_edit",
      "sprints:manage",
      "comments:create",
      "comments:delete.any",
      "comments:delete.own",
      "reports:view",
      "reports:export",
      "time:log_own",
      "time:view_team",
      "time:approve_timesheets",
      "chat:channels.create",
      "chat:channels.moderate",
      "chat:dm",
      "ai:use",
    ],
  },
  TEAM_LEAD: {
    name: "Team Lead",
    description: "Leads engineering or design teams, oversees tasks, approves work logs.",
    color: "#0891b2", // Cyan 600
    level: HIERARCHY_LEVELS.TEAM_LEAD,
    isSystem: false,
    permissions: [
      "members:view",
      "projects:edit",
      "tasks:create",
      "tasks:view.all",
      "tasks:edit.any",
      "tasks:delete.own",
      "tasks:assign",
      "tasks:transition",
      "tasks:bulk_edit",
      "sprints:manage",
      "comments:create",
      "comments:delete.own",
      "reports:view",
      "time:log_own",
      "time:view_team",
      "time:approve_timesheets",
      "chat:channels.create",
      "chat:dm",
      "ai:use",
    ],
  },
  MEMBER: {
    name: "Member",
    description: "Standard team member. Can create tasks, edit assigned tasks, and comment.",
    color: "#16a34a", // Green 600
    level: HIERARCHY_LEVELS.MEMBER,
    isSystem: true,
    permissions: [
      "members:view",
      "tasks:create",
      "tasks:view.all",
      "tasks:edit.own",
      "tasks:delete.own",
      "tasks:transition",
      "comments:create",
      "comments:delete.own",
      "reports:view",
      "time:log_own",
      "chat:dm",
      "ai:use",
    ],
  },
  VIEWER: {
    name: "Viewer",
    description: "Read-only access to projects, tasks, comments, and reports.",
    color: "#64748b", // Slate 500
    level: HIERARCHY_LEVELS.VIEWER,
    isSystem: true,
    permissions: [
      "members:view",
      "tasks:view.all",
      "reports:view",
      "chat:dm",
    ],
  },
  GUEST: {
    name: "Guest",
    description: "Restricted guest. Can only see tasks directly assigned to them.",
    color: "#d97706", // Amber 600
    level: HIERARCHY_LEVELS.GUEST,
    isSystem: true,
    permissions: [
      "tasks:view.assigned_only",
      "comments:create",
      "comments:delete.own",
      "chat:dm",
    ],
  },
  DEVELOPER: {
    name: "Developer",
    description: "Software engineer role with task creation, assignment, and work logging.",
    color: "#059669", // Emerald 600
    level: HIERARCHY_LEVELS.MEMBER,
    isSystem: false,
    permissions: [
      "members:view",
      "tasks:create",
      "tasks:view.all",
      "tasks:edit.own",
      "tasks:delete.own",
      "tasks:transition",
      "comments:create",
      "comments:delete.own",
      "reports:view",
      "time:log_own",
      "chat:dm",
      "ai:use",
    ],
  },
  DESIGNER: {
    name: "Designer",
    description: "UI/UX Designer role with sprint visibility and task workflows.",
    color: "#ec4899", // Pink 500
    level: HIERARCHY_LEVELS.MEMBER,
    isSystem: false,
    permissions: [
      "members:view",
      "tasks:create",
      "tasks:view.all",
      "tasks:edit.own",
      "tasks:delete.own",
      "tasks:transition",
      "comments:create",
      "comments:delete.own",
      "reports:view",
      "time:log_own",
      "chat:dm",
      "ai:use",
    ],
  },
  QA: {
    name: "QA Engineer",
    description: "Quality assurance role focused on filing bugs, transitions, and reviews.",
    color: "#ea580c", // Orange 600
    level: HIERARCHY_LEVELS.MEMBER,
    isSystem: false,
    permissions: [
      "members:view",
      "tasks:create",
      "tasks:view.all",
      "tasks:edit.any",
      "tasks:delete.own",
      "tasks:transition",
      "comments:create",
      "comments:delete.own",
      "reports:view",
      "time:log_own",
      "chat:dm",
      "ai:use",
    ],
  },
  HR: {
    name: "HR / People",
    description: "Manages member directories, timesheets, and attendance logs.",
    color: "#8b5cf6", // Purple 500
    level: HIERARCHY_LEVELS.PROJECT_MANAGER,
    isSystem: false,
    permissions: [
      "members:view",
      "members:invite",
      "time:view_team",
      "time:view_all",
      "time:approve_timesheets",
      "reports:view",
      "reports:export",
      "chat:dm",
    ],
  },
  CLIENT: {
    name: "Client (Read-only)",
    description: "External client viewing project progress and deliverables.",
    color: "#6b7280", // Gray 500
    level: HIERARCHY_LEVELS.CLIENT,
    isSystem: false,
    permissions: [
      "tasks:view.all",
      "reports:view",
      "chat:dm",
    ],
  },
  AUDITOR: {
    name: "Auditor",
    description: "Security and compliance auditor with read access to audit logs and reports.",
    color: "#0f766e", // Teal 700
    level: HIERARCHY_LEVELS.VIEWER,
    isSystem: false,
    permissions: [
      "members:view",
      "tasks:view.all",
      "reports:view",
      "reports:export",
      "audit:view",
    ],
  },
};
