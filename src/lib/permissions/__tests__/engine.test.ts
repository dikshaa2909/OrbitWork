import test from "node:test";
import assert from "node:assert";

import { can, isReportOf, MemberPermissionProfile } from "../engine";
import { HIERARCHY_LEVELS, SYSTEM_ROLE_TEMPLATES } from "../catalog";

// Mock profiles for testing
const ownerMember: MemberPermissionProfile = {
  id: "member-owner",
  userId: "user-1",
  workspaceId: "ws-1",
  role: {
    name: "Owner",
    level: HIERARCHY_LEVELS.OWNER,
    isSystem: true,
    permissions: SYSTEM_ROLE_TEMPLATES.OWNER.permissions,
  },
};

const adminMember: MemberPermissionProfile = {
  id: "member-admin",
  userId: "user-2",
  workspaceId: "ws-1",
  role: {
    name: "Admin",
    level: HIERARCHY_LEVELS.ADMIN,
    isSystem: true,
    permissions: SYSTEM_ROLE_TEMPLATES.ADMIN.permissions,
  },
};

const pmMember: MemberPermissionProfile = {
  id: "member-pm",
  userId: "user-3",
  workspaceId: "ws-1",
  role: {
    name: "Project Manager",
    level: HIERARCHY_LEVELS.PROJECT_MANAGER,
    isSystem: true,
    permissions: SYSTEM_ROLE_TEMPLATES.PROJECT_MANAGER.permissions,
  },
};

const devMember: MemberPermissionProfile = {
  id: "member-dev",
  userId: "user-4",
  workspaceId: "ws-1",
  reportsToId: "member-pm",
  role: {
    name: "Member",
    level: HIERARCHY_LEVELS.MEMBER,
    isSystem: true,
    permissions: SYSTEM_ROLE_TEMPLATES.MEMBER.permissions,
  },
  projectOverrides: {
    "project-alpha": {
      name: "Project Manager Override",
      level: HIERARCHY_LEVELS.PROJECT_MANAGER,
      isSystem: false,
      permissions: SYSTEM_ROLE_TEMPLATES.PROJECT_MANAGER.permissions,
    },
  },
};

const viewerMember: MemberPermissionProfile = {
  id: "member-viewer",
  userId: "user-5",
  workspaceId: "ws-1",
  role: {
    name: "Viewer",
    level: HIERARCHY_LEVELS.VIEWER,
    isSystem: true,
    permissions: SYSTEM_ROLE_TEMPLATES.VIEWER.permissions,
  },
};

const guestMember: MemberPermissionProfile = {
  id: "member-guest",
  userId: "user-6",
  workspaceId: "ws-1",
  role: {
    name: "Guest",
    level: HIERARCHY_LEVELS.GUEST,
    isSystem: true,
    permissions: SYSTEM_ROLE_TEMPLATES.GUEST.permissions,
  },
};

// 1. Owner always allowed
test("Engine: Owner has absolute bypass across all permissions", () => {
  assert.equal(can(ownerMember, "workspace:delete"), true);
  assert.equal(can(ownerMember, "workspace:settings.edit"), true);
  assert.equal(can(ownerMember, "roles:manage"), true);
  assert.equal(can(ownerMember, "tasks:edit.any"), true);
  assert.equal(can(ownerMember, "any:unregistered_future_permission"), true);
});

// 2. Admin permissions and restrictions
test("Engine: Admin has broad permissions but cannot delete workspace", () => {
  assert.equal(can(adminMember, "workspace:settings.edit"), true);
  assert.equal(can(adminMember, "roles:manage"), true);
  assert.equal(can(adminMember, "tasks:create"), true);
  assert.equal(can(adminMember, "workspace:delete"), false); // Denied
});

// 3. Project role override takes precedence
test("Engine: Project-level role override grants elevated permissions in that project", () => {
  // In workspace generally, devMember cannot create sprints or manage project settings
  assert.equal(can(devMember, "sprints:manage"), false);
  assert.equal(can(devMember, "projects:settings.manage"), false);

  // In project-alpha, devMember has Project Manager override -> allowed!
  assert.equal(can(devMember, "sprints:manage", { projectId: "project-alpha" }), true);
  assert.equal(can(devMember, "projects:settings.manage", { projectId: "project-alpha" }), true);

  // In project-beta (no override), devMember remains standard Member -> denied!
  assert.equal(can(devMember, "sprints:manage", { projectId: "project-beta" }), false);
});

// 4. "Own" vs "Any" resource permission resolution
test("Engine: Tasks own vs any editing and deletion rules", () => {
  // Member with edit.own can edit if they are assignee or reporter
  const ownTask = { reporterId: "member-dev", assigneeId: "member-other" };
  const assignedTask = { reporterId: "member-other", assigneeId: "member-dev" };
  const unownedTask = { reporterId: "member-other", assigneeId: "member-other" };

  assert.equal(can(devMember, "tasks:edit.any", { resource: ownTask }), true);
  assert.equal(can(devMember, "tasks:edit.any", { resource: assignedTask }), true);
  assert.equal(can(devMember, "tasks:edit.any", { resource: unownedTask }), false);

  // Deletion: only reporter can delete own task
  assert.equal(can(devMember, "tasks:delete.any", { resource: ownTask }), true);
  assert.equal(can(devMember, "tasks:delete.any", { resource: assignedTask }), false);
  assert.equal(can(devMember, "tasks:delete.any", { resource: unownedTask }), false);

  // Admin can delete any task regardless of ownership
  assert.equal(can(adminMember, "tasks:delete.any", { resource: unownedTask }), true);
});

// 5. Assigned-only visibility for Guests
test("Engine: Guest assigned-only visibility constraints", () => {
  const assignedToGuest = { assigneeId: "member-guest" };
  const notAssignedToGuest = { assigneeId: "member-dev" };

  assert.equal(can(guestMember, "tasks:view.all", { resource: assignedToGuest }), true);
  assert.equal(can(guestMember, "tasks:view.all", { resource: notAssignedToGuest }), false);
  assert.equal(can(guestMember, "tasks:create"), false);
});

// 6. Anti-Escalation Safety Rules
test("Engine: Anti-escalation blocks elevating beyond actor level or granting missing perms", () => {
  // Admin (level 10) cannot create or modify a role with level <= 10 (e.g. level 0 Owner or level 10 Admin)
  assert.equal(
    can(adminMember, "roles:manage", { targetRoleLevel: HIERARCHY_LEVELS.OWNER }),
    false
  );
  assert.equal(
    can(adminMember, "roles:manage", { targetRoleLevel: HIERARCHY_LEVELS.ADMIN }),
    false
  );
  // Admin CAN manage a role of level 20 or higher (PM, Member, etc.)
  assert.equal(
    can(adminMember, "roles:manage", { targetRoleLevel: HIERARCHY_LEVELS.PROJECT_MANAGER }),
    true
  );

  // Admin cannot grant a permission they don't hold (workspace:delete)
  assert.equal(
    can(adminMember, "roles:manage", {
      targetRoleLevel: 30,
      requestedPermissions: ["workspace:delete"],
    }),
    false
  );

  // Admin cannot modify a member who is Owner
  assert.equal(
    can(adminMember, "members:roles.assign", {
      targetMember: { id: "member-owner", level: HIERARCHY_LEVELS.OWNER },
      targetRoleLevel: HIERARCHY_LEVELS.ADMIN,
    }),
    false
  );
});

// 7. Hierarchy / Reporting Line Checking
test("Engine: Reporting line checks direct and indirect reports", () => {
  const membersMap = new Map([
    ["member-pm", { id: "member-pm", reportsToId: "member-admin" }],
    ["member-dev", { id: "member-dev", reportsToId: "member-pm" }],
    ["member-intern", { id: "member-intern", reportsToId: "member-dev" }],
    ["member-viewer", { id: "member-viewer", reportsToId: null }],
  ]);

  // Direct report
  assert.equal(isReportOf("member-pm", "member-dev", membersMap), true);

  // Indirect report (PM -> Dev -> Intern)
  assert.equal(isReportOf("member-pm", "member-intern", membersMap), true);
  assert.equal(isReportOf("member-admin", "member-intern", membersMap), true);

  // Reverse is not true
  assert.equal(isReportOf("member-intern", "member-pm", membersMap), false);

  // Unrelated member
  assert.equal(isReportOf("member-pm", "member-viewer", membersMap), false);
});

// 8. Default Deny Rule
test("Engine: Default Deny — null, empty, or ungranted roles deny all mutating operations", () => {
  assert.equal(can(null, "tasks:create"), false);
  assert.equal(can(undefined, "workspace:delete"), false);

  const emptyRoleMember: MemberPermissionProfile = {
    id: "member-empty",
    userId: "user-empty",
    workspaceId: "ws-1",
    role: {
      name: "Custom Empty Role",
      level: 50,
      isSystem: false,
      permissions: [],
    },
  };

  assert.equal(can(emptyRoleMember, "tasks:create"), false);
  assert.equal(can(emptyRoleMember, "projects:create"), false);
  assert.equal(can(emptyRoleMember, "workspace:settings.edit"), false);
  assert.equal(can(emptyRoleMember, "members:roles.assign"), false);

  // Viewer role cannot create tasks or projects
  assert.equal(can(viewerMember, "tasks:create"), false);
  assert.equal(can(viewerMember, "projects:create"), false);
});

// 9. Delegated Role Creation without Escalation
test("Engine: Delegated Role Creation without escalation", () => {
  const delegatedPmMember: MemberPermissionProfile = {
    ...pmMember,
    role: {
      ...pmMember.role,
      permissions: [...(pmMember.role.permissions as string[]), "roles:manage"],
    },
  };

  // Standard PM without delegation has roles:manage denied
  assert.equal(can(pmMember, "roles:manage"), false);

  // A PM with delegated roles:manage can create a role with level > 20 (e.g. 30 Member or 40 Viewer)
  // but CANNOT create level 0 (Owner), level 10 (Admin), or level 20 (PM)
  assert.equal(
    can(delegatedPmMember, "roles:manage", { targetRoleLevel: HIERARCHY_LEVELS.OWNER }),
    false
  );
  assert.equal(
    can(delegatedPmMember, "roles:manage", { targetRoleLevel: HIERARCHY_LEVELS.ADMIN }),
    false
  );
  assert.equal(
    can(delegatedPmMember, "roles:manage", { targetRoleLevel: HIERARCHY_LEVELS.PROJECT_MANAGER }),
    false
  );
  assert.equal(
    can(delegatedPmMember, "roles:manage", { targetRoleLevel: HIERARCHY_LEVELS.MEMBER }),
    true
  );

  // Delegated PM cannot grant permissions they do not possess (e.g. workspace:delete, workspace:settings.edit)
  assert.equal(
    can(delegatedPmMember, "roles:manage", {
      targetRoleLevel: HIERARCHY_LEVELS.MEMBER,
      requestedPermissions: ["workspace:delete"],
    }),
    false
  );
  assert.equal(
    can(delegatedPmMember, "roles:manage", {
      targetRoleLevel: HIERARCHY_LEVELS.MEMBER,
      requestedPermissions: ["workspace:settings.edit"],
    }),
    false
  );
  // Delegated PM CAN grant permissions they DO possess (e.g. tasks:create, sprints:manage)
  assert.equal(
    can(delegatedPmMember, "roles:manage", {
      targetRoleLevel: HIERARCHY_LEVELS.MEMBER,
      requestedPermissions: ["tasks:create", "sprints:manage"],
    }),
    true
  );
});

// 10. Temporary Grant Expiry & Limits
test("Engine: Temporary grants — active, expired, exhausted, revoked, and resource-scoped", () => {
  const futureDate = new Date(Date.now() + 86400000).toISOString(); // +1 day
  const pastDate = new Date(Date.now() - 86400000).toISOString(); // -1 day

  const memberWithGrants: MemberPermissionProfile = {
    id: "member-temp",
    userId: "user-temp",
    workspaceId: "ws-1",
    role: {
      name: "Viewer",
      level: HIERARCHY_LEVELS.VIEWER,
      isSystem: true,
      permissions: SYSTEM_ROLE_TEMPLATES.VIEWER.permissions,
    },
    grants: [
      // 1. Active time-limited grant for projects:create
      {
        permissionKey: "projects:create",
        grantType: "TIME_LIMITED",
        expiresAt: futureDate,
      },
      // 2. Expired time-limited grant for sprints:manage
      {
        permissionKey: "sprints:manage",
        grantType: "TIME_LIMITED",
        expiresAt: pastDate,
      },
      // 3. Exhausted one-time grant for tasks:create
      {
        permissionKey: "tasks:create",
        grantType: "ONE_TIME",
        usesRemaining: 0,
      },
      // 4. Revoked grant for workspace:settings.edit
      {
        permissionKey: "workspace:settings.edit",
        grantType: "PERMANENT",
        revoked: true,
      },
      // 5. Project-scoped grant for tasks:bulk_edit on project-alpha
      {
        permissionKey: "tasks:bulk_edit",
        grantType: "PERMANENT",
        resourceId: "project-alpha",
      },
    ],
  };

  // Active grant allows action
  assert.equal(can(memberWithGrants, "projects:create"), true);

  // Expired grant denies action
  assert.equal(can(memberWithGrants, "sprints:manage"), false);

  // Exhausted one-time grant denies action
  assert.equal(can(memberWithGrants, "tasks:create"), false);

  // Revoked grant denies action
  assert.equal(can(memberWithGrants, "workspace:settings.edit"), false);

  // Resource-scoped grant allows ONLY on specified project
  assert.equal(can(memberWithGrants, "tasks:bulk_edit", { projectId: "project-alpha" }), true);
  assert.equal(can(memberWithGrants, "tasks:bulk_edit", { projectId: "project-beta" }), false);
});

