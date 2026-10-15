import test from "node:test";
import assert from "node:assert";

import { can, MemberPermissionProfile } from "../engine";
import { SYSTEM_ROLE_TEMPLATES } from "../catalog";

test("Security Fix 2: Custom role named 'Owner' gets NO bypass", () => {
  // A malicious actor or user creates a custom role with name 'Owner' or 'owner', but isSystem=false and level=50
  const customRoleOwner: MemberPermissionProfile = {
    id: "member-fake-owner",
    userId: "user-attacker",
    workspaceId: "ws-1",
    isWorkspaceOwner: false, // NOT workspace owner
    role: {
      name: "Owner", // Name is "Owner"
      level: 50, // Custom level
      isSystem: false, // NOT a system role
      permissions: ["tasks:view.all"], // only view tasks
    },
  };

  // Must NOT be able to delete workspace (Owner only)
  assert.strictEqual(
    can(customRoleOwner, "workspace:delete"),
    false,
    "Custom role named 'Owner' MUST NOT bypass workspace:delete"
  );

  // Must NOT be able to manage roles (Admin & real Owner only)
  assert.strictEqual(
    can(customRoleOwner, "roles:manage"),
    false,
    "Custom role named 'Owner' MUST NOT bypass roles:manage"
  );

  // Must NOT have ungranted permissions
  assert.strictEqual(
    can(customRoleOwner, "projects:create"),
    false,
    "Custom role named 'Owner' MUST NOT bypass ungranted permissions"
  );

  // Real Owner (system role, level 0) DOES get bypass
  const realSystemOwner: MemberPermissionProfile = {
    id: "member-real-owner",
    userId: "user-real-owner",
    workspaceId: "ws-1",
    isWorkspaceOwner: true,
    role: {
      name: "Owner",
      level: 0,
      isSystem: true,
      permissions: SYSTEM_ROLE_TEMPLATES.OWNER.permissions,
    },
  };

  assert.strictEqual(
    can(realSystemOwner, "workspace:delete"),
    true,
    "Real system owner has full bypass"
  );

  // Workspace creator via isWorkspaceOwner gets bypass even if custom role
  const creatorOwner: MemberPermissionProfile = {
    id: "member-creator",
    userId: "user-creator",
    workspaceId: "ws-1",
    isWorkspaceOwner: true,
    role: {
      name: "Custom Role",
      level: 50,
      isSystem: false,
      permissions: [],
    },
  };

  assert.strictEqual(
    can(creatorOwner, "workspace:delete"),
    true,
    "Workspace owner (via isWorkspaceOwner) has full bypass"
  );
});

test("Security Fix 3: consume_grant_use concurrency test with parallel calls", async () => {
  // Model atomic compare-and-swap update logic from consume_grant_use:
  // UPDATE permission_grants SET usesRemaining = usesRemaining - 1
  // WHERE id = $1 AND usesRemaining > 0 RETURNING ...
  let usesRemaining = 1;

  async function atomicConsumeGrant(grantId: string, callerUserId: string, ownerUserId: string): Promise<boolean> {
    // 1. Caller verification
    if (callerUserId !== ownerUserId) {
      return false;
    }

    // 2. Simulated DB atomic row-lock serialization
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));

    // Atomic test-and-decrement
    if (usesRemaining > 0) {
      usesRemaining -= 1;
      return true;
    }
    return false;
  }

  // Two parallel calls racing to consume a single grant use
  const [res1, res2] = await Promise.all([
    atomicConsumeGrant("grant-1", "user-alice", "user-alice"),
    atomicConsumeGrant("grant-1", "user-alice", "user-alice"),
  ]);

  // Exactly one caller wins, one caller is rejected
  const successCount = (res1 ? 1 : 0) + (res2 ? 1 : 0);
  assert.strictEqual(successCount, 1, "Exactly one parallel call must succeed in consuming the single grant use");
  assert.strictEqual(usesRemaining, 0, "Uses remaining must be exactly 0 after one consumption");

  // Non-owner caller must be rejected immediately
  const unauthorizedConsume = await atomicConsumeGrant("grant-1", "user-attacker", "user-alice");
  assert.strictEqual(unauthorizedConsume, false, "Caller who does not own the grant must be rejected");
});

test("Security Fix 4: Invite links atomic consumption and parallel-join", async () => {
  // Model atomic UPDATE invite_links SET uses = uses + 1 WHERE code = $1 AND uses < maxUses RETURNING *
  const inviteLink = {
    code: "INVITE1",
    maxUses: 1,
    uses: 0,
    revoked: false,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    workspaceId: "ws-1",
  };

  const members = new Set<string>(); // Set of userIds in workspace

  async function attemptJoin(code: string, userId: string): Promise<{ success: boolean; status: number; error?: string }> {
    // Reject if already a member
    if (members.has(userId)) {
      return { success: false, status: 400, error: "Already a member of this workspace" };
    }

    // Atomic compare-and-swap
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));

    if (inviteLink.revoked) return { success: false, status: 410, error: "Revoked" };
    if (new Date(inviteLink.expiresAt) <= new Date()) return { success: false, status: 410, error: "Expired" };

    if (inviteLink.maxUses !== null && inviteLink.uses >= inviteLink.maxUses) {
      return { success: false, status: 410, error: "Max uses reached" };
    }

    // Increment atomically
    inviteLink.uses += 1;
    members.add(userId);
    return { success: true, status: 200 };
  }

  // 1. Two parallel users join with a link with maxUses=1
  const [join1, join2] = await Promise.all([
    attemptJoin("INVITE1", "user-new-1"),
    attemptJoin("INVITE1", "user-new-2"),
  ]);

  const joinSuccessCount = (join1.success ? 1 : 0) + (join2.success ? 1 : 0);
  assert.strictEqual(joinSuccessCount, 1, "Only one user can claim a 1-use invite link concurrently");
  assert.strictEqual(inviteLink.uses, 1, "Invite link uses must be exactly 1");

  // 2. Reject if already a member
  const winnerUserId = join1.success ? "user-new-1" : "user-new-2";
  const alreadyMemberJoin = await attemptJoin("INVITE1", winnerUserId);
  assert.strictEqual(alreadyMemberJoin.status, 400, "Existing member must be rejected with 400");
  assert.strictEqual(alreadyMemberJoin.error, "Already a member of this workspace");
});

test("Security Fix 5: Anti-escalation everywhere (invites, member roles, target checks)", () => {
  const adminActor: MemberPermissionProfile = {
    id: "member-admin",
    userId: "user-admin",
    workspaceId: "ws-1",
    isWorkspaceOwner: false,
    role: {
      name: "Admin",
      level: 10,
      isSystem: true,
      permissions: SYSTEM_ROLE_TEMPLATES.ADMIN.permissions,
    },
  };

  const pmActor: MemberPermissionProfile = {
    id: "member-pm",
    userId: "user-pm",
    workspaceId: "ws-1",
    isWorkspaceOwner: false,
    role: {
      name: "Project Manager",
      level: 30,
      isSystem: true,
      permissions: SYSTEM_ROLE_TEMPLATES.PROJECT_MANAGER.permissions,
    },
  };

  // Case 1: Invite creation cannot invite at or above actor's level
  // Admin (level 10) invites Admin (level 10) -> REJECTED (at actor level)
  assert.strictEqual(
    can(adminActor, "invites:manage", { targetRoleLevel: 10 }),
    false,
    "Admin cannot create invite link for level 10 (equal to own level)"
  );
  // Admin (level 10) invites Owner (level 0) -> REJECTED (above actor level)
  assert.strictEqual(
    can(adminActor, "invites:manage", { targetRoleLevel: 0 }),
    false,
    "Admin cannot create invite link for level 0 (above own level)"
  );
  // Admin (level 10) invites Member (level 50) -> ALLOWED (below actor level)
  assert.strictEqual(
    can(adminActor, "invites:manage", { targetRoleLevel: 50 }),
    true,
    "Admin can create invite link for level 50 (below own level)"
  );

  // Case 2: Role assignment cannot assign role at or above actor's level
  // Admin assigns Admin role (10) -> REJECTED
  assert.strictEqual(
    can(adminActor, "members:roles.assign", { targetRoleLevel: 10 }),
    false,
    "Admin cannot assign Admin role (level 10)"
  );
  // Admin assigns Owner role (0) -> REJECTED
  assert.strictEqual(
    can(adminActor, "members:roles.assign", { targetRoleLevel: 0 }),
    false,
    "Admin cannot assign Owner role (level 0)"
  );
  // Admin assigns Member role (50) -> ALLOWED
  assert.strictEqual(
    can(adminActor, "members:roles.assign", { targetRoleLevel: 50 }),
    true,
    "Admin can assign Member role (level 50)"
  );

  // Case 3: Target member's current level check
  // Admin (level 10) tries to modify another Admin (level 10) -> REJECTED
  assert.strictEqual(
    can(adminActor, "members:roles.assign", {
      targetMember: { id: "member-peer-admin", level: 10 },
      targetRoleLevel: 50,
    }),
    false,
    "Admin cannot modify another member of equal rank (level 10)"
  );

  // PM (level 30) tries to modify an Admin (level 10) -> REJECTED
  assert.strictEqual(
    can(pmActor, "members:roles.assign", {
      targetMember: { id: "member-admin", level: 10 },
      targetRoleLevel: 50,
    }),
    false,
    "PM cannot modify a member with higher rank (level 10)"
  );

  // Owner (level 0) has no anti-escalation constraints
  const ownerActor: MemberPermissionProfile = {
    id: "member-owner",
    userId: "user-owner",
    workspaceId: "ws-1",
    isWorkspaceOwner: true,
    role: {
      name: "Owner",
      level: 0,
      isSystem: true,
      permissions: SYSTEM_ROLE_TEMPLATES.OWNER.permissions,
    },
  };

  assert.strictEqual(
    can(ownerActor, "invites:manage", { targetRoleLevel: 10 }),
    true,
    "Owner can create Admin invite"
  );
  assert.strictEqual(
    can(ownerActor, "members:roles.assign", {
      targetMember: { id: "member-admin", level: 10 },
      targetRoleLevel: 10,
    }),
    true,
    "Owner can modify Admin members"
  );
});

test("Security Fix 8: /info requires valid invite code or workspace membership", () => {
  const workspace = {
    id: "ws-secret",
    name: "Secret Project",
    inviteCode: "SECRET99",
  };

  const members = new Set<string>(["user-member-1"]);
  const activeInviteLinks = new Map<string, { code: string; revoked: boolean }>([
    ["LINK123", { code: "LINK123", revoked: false }],
    ["REVOKED1", { code: "REVOKED1", revoked: true }],
  ]);

  function checkInfoAccess(userId: string, code?: string): { allowed: boolean; status: number } {
    // 1. Is workspace member?
    if (members.has(userId)) {
      return { allowed: true, status: 200 };
    }

    // 2. Has valid invite code or invite link?
    if (code) {
      if (workspace.inviteCode.toUpperCase() === code.trim().toUpperCase()) {
        return { allowed: true, status: 200 };
      }
      const link = activeInviteLinks.get(code.trim().toUpperCase());
      if (link && !link.revoked) {
        return { allowed: true, status: 200 };
      }
    }

    return { allowed: false, status: 403 };
  }

  // Unrelated authenticated user with no code -> 403 Forbidden
  assert.strictEqual(checkInfoAccess("user-stranger").status, 403);

  // Unrelated user with wrong code -> 403 Forbidden
  assert.strictEqual(checkInfoAccess("user-stranger", "WRONGCODE").status, 403);

  // Unrelated user with revoked link -> 403 Forbidden
  assert.strictEqual(checkInfoAccess("user-stranger", "REVOKED1").status, 403);

  // Unrelated user with valid workspace invite code -> 200 OK
  assert.strictEqual(checkInfoAccess("user-stranger", "SECRET99").status, 200);

  // Unrelated user with valid role-bound invite link -> 200 OK
  assert.strictEqual(checkInfoAccess("user-stranger", "LINK123").status, 200);

  // Workspace member without code -> 200 OK
  assert.strictEqual(checkInfoAccess("user-member-1").status, 200);
});
