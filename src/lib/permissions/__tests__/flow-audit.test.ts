import { describe, it } from "node:test";
import assert from "node:assert";
import {
  can,
  MemberPermissionProfile,
  PermissionGrantData,
} from "../engine";

// Helper fixture
const makeProfile = (
  roleName: string,
  level: number,
  permissions: Record<string, boolean> | string[],
  grants: PermissionGrantData[] = []
): MemberPermissionProfile => ({
  id: `member-${roleName.toLowerCase()}`,
  userId: `user-${roleName.toLowerCase()}`,
  workspaceId: "ws-flow-audit",
  role: {
    id: `role-${roleName.toLowerCase()}`,
    name: roleName,
    level,
    isSystem: true,
    permissions,
  },
  projectOverrides: {},
  reportsToId: null,
  grants,
});

describe("PART C2 Complete Flow Audit Tests", () => {
  // ── 1. OWNER FLOWS ────────────────────────────────────────────────────────
  it("Owner (Level 0): Has full access to delete workspace, manage roles, and bypasses all denies", () => {
    const owner = makeProfile("Owner", 0, {});
    assert.strictEqual(can(owner, "workspace:delete"), true);
    assert.strictEqual(can(owner, "workspace:settings.edit"), true);
    assert.strictEqual(can(owner, "roles:manage"), true);
    assert.strictEqual(can(owner, "projects:create"), true);
    assert.strictEqual(can(owner, "projects:delete"), true);
    assert.strictEqual(can(owner, "tasks:create"), true);
    assert.strictEqual(can(owner, "tasks:delete.any"), true);
    assert.strictEqual(can(owner, "requests:review"), true);
    assert.strictEqual(can(owner, "invites:manage"), true);
  });

  // ── 2. ADMIN FLOWS ────────────────────────────────────────────────────────
  it("Admin (Level 10): Manages roles, invites, projects, tasks, but cannot delete workspace", () => {
    const admin = makeProfile("Admin", 10, {
      "workspace:settings.edit": true,
      "members:invite": true,
      "members:remove": true,
      "members:roles.assign": true,
      "roles:manage": true,
      "projects:create": true,
      "projects:edit": true,
      "projects:delete": true,
      "tasks:create": true,
      "tasks:edit.any": true,
      "tasks:delete.any": true,
      "tasks:transition": true,
      "tasks:view.all": true,
      "requests:review": true,
      "invites:manage": true,
    });

    assert.strictEqual(can(admin, "workspace:delete"), false, "Admin must NOT be able to delete workspace");
    assert.strictEqual(can(admin, "workspace:settings.edit"), true);
    assert.strictEqual(can(admin, "roles:manage"), true);
    assert.strictEqual(can(admin, "requests:review"), true);
    assert.strictEqual(can(admin, "projects:create"), true);
    assert.strictEqual(can(admin, "tasks:delete.any"), true);
  });

  // ── 3. PROJECT MANAGER FLOWS ──────────────────────────────────────────────
  it("Project Manager (Level 30): Manages projects, tasks, sprints, but cannot manage workspace roles or delete workspace", () => {
    const pm = makeProfile("Project Manager", 30, {
      "projects:create": true,
      "projects:edit": true,
      "sprints:manage": true,
      "tasks:create": true,
      "tasks:edit.any": true,
      "tasks:delete.own": true,
      "tasks:assign": true,
      "tasks:transition": true,
      "tasks:view.all": true,
      "comments:create": true,
    });

    assert.strictEqual(can(pm, "workspace:delete"), false);
    assert.strictEqual(can(pm, "workspace:settings.edit"), false);
    assert.strictEqual(can(pm, "roles:manage"), false);
    assert.strictEqual(can(pm, "projects:create"), true);
    assert.strictEqual(can(pm, "sprints:manage"), true);
    assert.strictEqual(can(pm, "tasks:create"), true);
    assert.strictEqual(can(pm, "tasks:transition"), true);
    assert.strictEqual(can(pm, "tasks:delete.any"), false);
  });

  // ── 4. MEMBER FLOWS ───────────────────────────────────────────────────────
  it("Member (Level 50): Can create tasks, transition cards, edit own tasks; cannot create projects or delete others tasks", () => {
    const member = makeProfile("Member", 50, {
      "tasks:create": true,
      "tasks:edit.own": true,
      "tasks:delete.own": true,
      "tasks:transition": true,
      "tasks:view.all": true,
      "comments:create": true,
      "comments:edit.own": true,
    });

    assert.strictEqual(can(member, "projects:create"), false, "Member cannot create projects");
    assert.strictEqual(can(member, "workspace:delete"), false);
    assert.strictEqual(can(member, "tasks:create"), true);
    assert.strictEqual(can(member, "tasks:transition"), true);

    // Own task vs someone else's task
    assert.strictEqual(can(member, "tasks:edit.any", { resource: { assigneeId: member.id } }), true);
    assert.strictEqual(can(member, "tasks:edit.any", { resource: { assigneeId: "other-user" } }), false);
    assert.strictEqual(can(member, "tasks:delete.any", { resource: { reporterId: member.id } }), true);
    assert.strictEqual(can(member, "tasks:delete.any", { resource: { reporterId: "other-user" } }), false);
  });

  // ── 5. VIEWER FLOWS (DENY BY DEFAULT) ─────────────────────────────────────
  it("Viewer (Level 80): Read-only across everything; denied all mutations", () => {
    const viewer = makeProfile("Viewer", 80, {
      "tasks:view.all": true,
    });

    assert.strictEqual(can(viewer, "tasks:create"), false);
    assert.strictEqual(can(viewer, "tasks:transition"), false);
    assert.strictEqual(can(viewer, "tasks:edit.own"), false);
    assert.strictEqual(can(viewer, "tasks:delete.own"), false);
    assert.strictEqual(can(viewer, "projects:create"), false);
    assert.strictEqual(can(viewer, "workspace:delete"), false);
    assert.strictEqual(can(viewer, "comments:create"), false);
    assert.strictEqual(can(viewer, "tasks:view.all"), true);
  });

  // ── 6. GUEST FLOWS ────────────────────────────────────────────────────────
  it("Guest (Level 90): Only views tasks assigned to them; denied view.all and all mutations", () => {
    const guest = makeProfile("Guest", 90, {
      "tasks:view.assigned_only": true,
    });

    assert.strictEqual(can(guest, "tasks:view.all"), false);
    assert.strictEqual(can(guest, "tasks:view.all", { resource: { assigneeId: guest.id } }), true);
    assert.strictEqual(can(guest, "tasks:view.all", { resource: { assigneeId: "other-user" } }), false);
    assert.strictEqual(can(guest, "tasks:create"), false);
    assert.strictEqual(can(guest, "tasks:transition"), false);
  });

  // ── 7. TEMPORARY ACCESS GRANTS LIFECYCLE ──────────────────────────────────
  it("Temporary Grants: Active grants elevate permissions; expired or revoked grants revert to deny", () => {
    const now = Date.now();
    const activeGrant: PermissionGrantData = {
      permissionKey: "tasks:create",
      grantType: "TIME_LIMITED",
      expiresAt: new Date(now + 86400000).toISOString(), // +24 hours
      revoked: false,
    };
    const expiredGrant: PermissionGrantData = {
      permissionKey: "projects:create",
      grantType: "TIME_LIMITED",
      expiresAt: new Date(now - 1000).toISOString(), // expired
      revoked: false,
    };
    const revokedGrant: PermissionGrantData = {
      permissionKey: "sprints:manage",
      grantType: "PERMANENT",
      revoked: true,
    };
    const oneTimeGrant: PermissionGrantData = {
      permissionKey: "tasks:bulk_edit",
      grantType: "ONE_TIME",
      usesRemaining: 1,
      revoked: false,
    };
    const exhaustedGrant: PermissionGrantData = {
      permissionKey: "tasks:delete.any",
      grantType: "ONE_TIME",
      usesRemaining: 0,
      revoked: false,
    };

    const viewerWithGrants = makeProfile("Viewer", 80, {}, [
      activeGrant,
      expiredGrant,
      revokedGrant,
      oneTimeGrant,
      exhaustedGrant,
    ]);

    assert.strictEqual(can(viewerWithGrants, "tasks:create"), true, "Active grant must elevate Viewer");
    assert.strictEqual(can(viewerWithGrants, "projects:create"), false, "Expired grant must be denied");
    assert.strictEqual(can(viewerWithGrants, "sprints:manage"), false, "Revoked grant must be denied");
    assert.strictEqual(can(viewerWithGrants, "tasks:bulk_edit"), true, "One-time grant with remaining uses must pass");
    assert.strictEqual(can(viewerWithGrants, "tasks:delete.any"), false, "Exhausted one-time grant must be denied");
  });

  // ── 8. RESOURCE SCOPED GRANTS ─────────────────────────────────────────────
  it("Resource Scoped Grants: Scoped grant applies ONLY to the designated resource", () => {
    const scopedGrant: PermissionGrantData = {
      permissionKey: "tasks:create",
      grantType: "TIME_LIMITED",
      resourceType: "project",
      resourceId: "proj-alpha",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      revoked: false,
    };

    const viewer = makeProfile("Viewer", 80, {}, [scopedGrant]);

    // Checking project alpha
    assert.strictEqual(can(viewer, "tasks:create", { projectId: "proj-alpha" }), true);
    // Checking project beta
    assert.strictEqual(can(viewer, "tasks:create", { projectId: "proj-beta" }), false);
  });

  // ── 9. ANTI-ESCALATION ENFORCEMENT ────────────────────────────────────────
  it("Anti-Escalation: Nobody can assign or elevate anyone beyond their own level or unheld permissions", () => {
    const admin = makeProfile("Admin", 10, { "members:roles.assign": true });

    // Admin (level 10) cannot assign or modify Owner (level 0)
    assert.strictEqual(can(admin, "members:roles.assign", { targetMember: { id: "member-owner", level: 0 }, targetRoleLevel: 10 }), false);
    // Admin (level 10) can assign role of level 30 (PM) to a member of level 50
    assert.strictEqual(can(admin, "members:roles.assign", { targetMember: { id: "member-dev", level: 50 }, targetRoleLevel: 30 }), true);
    // Admin cannot grant a permission they don't hold (e.g. workspace:delete)
    assert.strictEqual(can(admin, "roles:manage", { targetRoleLevel: 30, requestedPermissions: ["workspace:delete"] }), false);
  });

  // ── 10. NON-MEMBER & NULL PROFILE (DENY BY DEFAULT) ───────────────────────
  it("Deny By Default: Null or unauthenticated profiles return false for everything", () => {
    assert.strictEqual(can(null, "tasks:view.all"), false);
    assert.strictEqual(can(null, "tasks:create"), false);
    assert.strictEqual(can(null, "projects:create"), false);
    assert.strictEqual(can(null, "workspace:delete"), false);
  });
});
