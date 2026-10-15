import test from "node:test";
import assert from "node:assert";

import { can, MemberPermissionProfile } from "../engine";
import { HIERARCHY_LEVELS, SYSTEM_ROLE_TEMPLATES } from "../catalog";

// Mock profiles for all 6 roles
const ownerProfile: MemberPermissionProfile = {
  id: "member-owner",
  userId: "user-owner",
  workspaceId: "ws-test",
  role: {
    name: "Owner",
    level: HIERARCHY_LEVELS.OWNER,
    isSystem: true,
    permissions: SYSTEM_ROLE_TEMPLATES.OWNER.permissions,
  },
};

const adminProfile: MemberPermissionProfile = {
  id: "member-admin",
  userId: "user-admin",
  workspaceId: "ws-test",
  role: {
    name: "Admin",
    level: HIERARCHY_LEVELS.ADMIN,
    isSystem: true,
    permissions: SYSTEM_ROLE_TEMPLATES.ADMIN.permissions,
  },
};

const pmProfile: MemberPermissionProfile = {
  id: "member-pm",
  userId: "user-pm",
  workspaceId: "ws-test",
  role: {
    name: "Project Manager",
    level: HIERARCHY_LEVELS.PROJECT_MANAGER,
    isSystem: true,
    permissions: SYSTEM_ROLE_TEMPLATES.PROJECT_MANAGER.permissions,
  },
};

const memberProfile: MemberPermissionProfile = {
  id: "member-user",
  userId: "user-member",
  workspaceId: "ws-test",
  role: {
    name: "Member",
    level: HIERARCHY_LEVELS.MEMBER,
    isSystem: true,
    permissions: SYSTEM_ROLE_TEMPLATES.MEMBER.permissions,
  },
};

const viewerProfile: MemberPermissionProfile = {
  id: "member-viewer",
  userId: "user-viewer",
  workspaceId: "ws-test",
  role: {
    name: "Viewer",
    level: HIERARCHY_LEVELS.VIEWER,
    isSystem: true,
    permissions: SYSTEM_ROLE_TEMPLATES.VIEWER.permissions,
  },
};

const guestProfile: MemberPermissionProfile = {
  id: "member-guest",
  userId: "user-guest",
  workspaceId: "ws-test",
  role: {
    name: "Guest",
    level: HIERARCHY_LEVELS.GUEST,
    isSystem: true,
    permissions: SYSTEM_ROLE_TEMPLATES.GUEST.permissions,
  },
};

// =============================================================================
// ROUTE GROUP 1: WORKSPACES API
// =============================================================================
test("API Perms — Workspaces: workspace:delete is Owner-only", () => {
  assert.equal(can(ownerProfile, "workspace:delete"), true);
  assert.equal(can(adminProfile, "workspace:delete"), false);
  assert.equal(can(pmProfile, "workspace:delete"), false);
  assert.equal(can(memberProfile, "workspace:delete"), false);
  assert.equal(can(viewerProfile, "workspace:delete"), false);
  assert.equal(can(guestProfile, "workspace:delete"), false);
});

test("API Perms — Workspaces: workspace:settings.edit allowed for Owner & Admin", () => {
  assert.equal(can(ownerProfile, "workspace:settings.edit"), true);
  assert.equal(can(adminProfile, "workspace:settings.edit"), true);
  assert.equal(can(pmProfile, "workspace:settings.edit"), false);
  assert.equal(can(memberProfile, "workspace:settings.edit"), false);
  assert.equal(can(viewerProfile, "workspace:settings.edit"), false);
  assert.equal(can(guestProfile, "workspace:settings.edit"), false);
});

// =============================================================================
// ROUTE GROUP 2: PROJECTS API
// =============================================================================
test("API Perms — Projects: projects:create allowed for Owner, Admin, PM", () => {
  assert.equal(can(ownerProfile, "projects:create"), true);
  assert.equal(can(adminProfile, "projects:create"), true);
  assert.equal(can(pmProfile, "projects:create"), true);
  assert.equal(can(memberProfile, "projects:create"), false);
  assert.equal(can(viewerProfile, "projects:create"), false);
  assert.equal(can(guestProfile, "projects:create"), false);
});

test("API Perms — Projects: projects:delete allowed for Owner & Admin", () => {
  assert.equal(can(ownerProfile, "projects:delete"), true);
  assert.equal(can(adminProfile, "projects:delete"), true);
  assert.equal(can(pmProfile, "projects:delete"), false);
  assert.equal(can(memberProfile, "projects:delete"), false);
  assert.equal(can(viewerProfile, "projects:delete"), false);
  assert.equal(can(guestProfile, "projects:delete"), false);
});

// =============================================================================
// ROUTE GROUP 3: TASKS API
// =============================================================================
test("API Perms — Tasks: tasks:create allowed for Member and above, denied for Viewer & Guest", () => {
  assert.equal(can(ownerProfile, "tasks:create"), true);
  assert.equal(can(adminProfile, "tasks:create"), true);
  assert.equal(can(pmProfile, "tasks:create"), true);
  assert.equal(can(memberProfile, "tasks:create"), true);
  assert.equal(can(viewerProfile, "tasks:create"), false);
  assert.equal(can(guestProfile, "tasks:create"), false);
});

test("API Perms — Tasks: tasks:transition (drag & drop) allowed for Member and above", () => {
  assert.equal(can(ownerProfile, "tasks:transition"), true);
  assert.equal(can(adminProfile, "tasks:transition"), true);
  assert.equal(can(pmProfile, "tasks:transition"), true);
  assert.equal(can(memberProfile, "tasks:transition"), true);
  assert.equal(can(viewerProfile, "tasks:transition"), false);
  assert.equal(can(guestProfile, "tasks:transition"), false);
});

test("API Perms — Tasks: tasks:view.all vs assigned-only for Guests", () => {
  assert.equal(can(ownerProfile, "tasks:view.all"), true);
  assert.equal(can(adminProfile, "tasks:view.all"), true);
  assert.equal(can(pmProfile, "tasks:view.all"), true);
  assert.equal(can(memberProfile, "tasks:view.all"), true);
  assert.equal(can(viewerProfile, "tasks:view.all"), true);
  // Guest cannot view all tasks unconditionally
  assert.equal(can(guestProfile, "tasks:view.all"), false);
});

// =============================================================================
// ROUTE GROUP 4: SPRINTS API
// =============================================================================
test("API Perms — Sprints: sprints:manage allowed for PM and above", () => {
  assert.equal(can(ownerProfile, "sprints:manage"), true);
  assert.equal(can(adminProfile, "sprints:manage"), true);
  assert.equal(can(pmProfile, "sprints:manage"), true);
  assert.equal(can(memberProfile, "sprints:manage"), false);
  assert.equal(can(viewerProfile, "sprints:manage"), false);
  assert.equal(can(guestProfile, "sprints:manage"), false);
});

// =============================================================================
// ROUTE GROUP 5: MEMBERS & ROLES API
// =============================================================================
test("API Perms — Members: members:roles.assign allowed for Owner & Admin", () => {
  assert.equal(can(ownerProfile, "members:roles.assign"), true);
  assert.equal(can(adminProfile, "members:roles.assign"), true);
  assert.equal(can(pmProfile, "members:roles.assign"), false);
  assert.equal(can(memberProfile, "members:roles.assign"), false);
  assert.equal(can(viewerProfile, "members:roles.assign"), false);
  assert.equal(can(guestProfile, "members:roles.assign"), false);
});

test("API Perms — Roles: roles:manage allowed for Owner & Admin", () => {
  assert.equal(can(ownerProfile, "roles:manage"), true);
  assert.equal(can(adminProfile, "roles:manage"), true);
  assert.equal(can(pmProfile, "roles:manage"), false);
  assert.equal(can(memberProfile, "roles:manage"), false);
  assert.equal(can(viewerProfile, "roles:manage"), false);
  assert.equal(can(guestProfile, "roles:manage"), false);
});

// =============================================================================
// ROUTE GROUP 6: ACCESS REQUESTS & INVITE LINKS
// =============================================================================
test("API Perms — Access Requests: requests:review allowed for Owner & Admin by default", () => {
  assert.equal(can(ownerProfile, "requests:review"), true);
  assert.equal(can(adminProfile, "requests:review"), true);
  assert.equal(can(pmProfile, "requests:review"), false);
  assert.equal(can(memberProfile, "requests:review"), false);
  assert.equal(can(viewerProfile, "requests:review"), false);
  assert.equal(can(guestProfile, "requests:review"), false);
});

test("API Perms — Invite Links: invites:manage allowed for Owner & Admin by default", () => {
  assert.equal(can(ownerProfile, "invites:manage"), true);
  assert.equal(can(adminProfile, "invites:manage"), true);
  assert.equal(can(pmProfile, "invites:manage"), false);
  assert.equal(can(memberProfile, "invites:manage"), false);
  assert.equal(can(viewerProfile, "invites:manage"), false);
  assert.equal(can(guestProfile, "invites:manage"), false);
});
