import { z } from "zod";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import { createAdminClient, Query } from "@/lib/supabase";
import { DATABASE_ID, MEMBERS_ID, ROLES_ID, WORKSPACES_ID } from "@/config";
import { sessionMiddleware } from "@/lib/session-middleware";
import { can, isReportOf } from "@/lib/permissions/engine";
import { getMemberPermissionProfile, logPermissionAudit } from "@/lib/permissions/server";
import { Role } from "@/features/roles/types";
import { Workspace } from "@/features/workspaces/types";

import { getMember } from "../utils";
import { Member, MemberRole } from "../types";

const app = new Hono()
  .get(
    "/",
    sessionMiddleware,
    zValidator("query", z.object({ workspaceId: z.string() })),
    async (c) => {
      const { users } = await createAdminClient();
      const databases = c.get("databases");
      const user = c.get("user");
      const { workspaceId } = c.req.valid("query");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const members = await databases.listDocuments<Member>(
        DATABASE_ID,
        MEMBERS_ID,
        [Query.equal("workspaceId", workspaceId)]
      );

      const populatedMembers = await Promise.all(
        members.documents.map(async (member) => {
          const user = await users.get(member.userId);
          let roleName = member.role as string;
          if (member.roleId) {
            const roleDoc = await databases.getDocument<{ name: string }>(DATABASE_ID, ROLES_ID, member.roleId).catch(() => null);
            if (roleDoc) roleName = roleDoc.name;
          }

          return {
            ...member,
            name: user.name || user.email,
            email: user.email,
            roleName,
          };
        })
      );

      return c.json({
        data: {
          ...members,
          documents: populatedMembers,
        },
      });
    }
  )
  .get(
    "/current",
    sessionMiddleware,
    zValidator("query", z.object({ workspaceId: z.string() })),
    async (c) => {
      const databases = c.get("databases");
      const user = c.get("user");
      const { workspaceId } = c.req.valid("query");

      const member = await getMember({
        databases,
        workspaceId,
        userId: user.$id,
      });

      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      let roleName = member.role as string;
      if (member.roleId) {
        const roleDoc = await databases.getDocument<{ name: string }>(DATABASE_ID, ROLES_ID, member.roleId).catch(() => null);
        if (roleDoc) roleName = roleDoc.name;
      }

      return c.json({ data: { ...member, roleName } });
    }
  )
  .delete(
    "/:memberId",
    sessionMiddleware,
    async (c) => {
      const { memberId } = c.req.param();
      const user = c.get("user");
      const databases = c.get("databases");

      const memberToDelete = await databases.getDocument<Member>(
        DATABASE_ID,
        MEMBERS_ID,
        memberId,
      );

      const allMembersInWorkspace = await databases.listDocuments(
        DATABASE_ID,
        MEMBERS_ID,
        [Query.equal("workspaceId", memberToDelete.workspaceId)]
      );

      const profile = await getMemberPermissionProfile(
        databases,
        memberToDelete.workspaceId,
        user.$id
      );

      if (!profile) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const isSelf = profile.id === memberToDelete.$id || profile.id === memberToDelete.id;
      if (!isSelf && !can(profile, "members:remove")) {
        return c.json(
          { error: "Forbidden: 'members:remove' permission required", requiredPermission: "members:remove", canRequest: true },
          403
        );
      }

      // Check if target is workspace owner (by creator userId or system owner flag)
      const ws = await databases.getDocument<Workspace>(DATABASE_ID, WORKSPACES_ID, memberToDelete.workspaceId);
      const isTargetOwner = ws.userId === memberToDelete.userId;
      if (isTargetOwner) {
        return c.json({ error: "Cannot delete or leave workspace as owner. Transfer ownership or delete the workspace." }, 403);
      }
      
      if (allMembersInWorkspace.total === 1) {
        return c.json({ error: "Cannot delete the only member" }, 400);
      }

      await databases.deleteDocument(
        DATABASE_ID,
        MEMBERS_ID,
        memberId,
      );

      await logPermissionAudit(databases, {
        workspaceId: memberToDelete.workspaceId,
        actorMemberId: profile.id,
        action: "DELETE",
        entityType: "MEMBER_ROLE",
        entityId: memberId,
        oldValues: { removedUserId: memberToDelete.userId },
      });

      return c.json({ data: { $id: memberToDelete.$id } });
    }
  )
  .patch(
    "/:memberId",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        role: z.nativeEnum(MemberRole).optional(),
        roleId: z.string().nullish(),
        reportsToId: z.string().nullish(),
      })
    ),
    async (c) => {
      const { memberId } = c.req.param();
      const { role, roleId, reportsToId } = c.req.valid("json");
      const user = c.get("user");
      const databases = c.get("databases");

      const memberToUpdate = await databases.getDocument<Member>(
        DATABASE_ID,
        MEMBERS_ID,
        memberId,
      );

      const allMembersInWorkspace = await databases.listDocuments(
        DATABASE_ID,
        MEMBERS_ID,
        [Query.equal("workspaceId", memberToUpdate.workspaceId)]
      );

      const profile = await getMemberPermissionProfile(
        databases,
        memberToUpdate.workspaceId,
        user.$id
      );

      if (!profile) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      if (!can(profile, "members:roles.assign")) {
        return c.json(
          { error: "Forbidden: 'members:roles.assign' permission required", requiredPermission: "members:roles.assign", canRequest: true },
          403
        );
      }

      const isActorOwner = profile.isWorkspaceOwner === true || (profile.role.isSystem && profile.role.level === 0);

      // Check if target member is workspace owner
      const ws = await databases.getDocument<Workspace>(DATABASE_ID, WORKSPACES_ID, memberToUpdate.workspaceId);
      const isTargetOwner = ws.userId === memberToUpdate.userId;
      if (isTargetOwner && !isActorOwner) {
        return c.json({ error: "Cannot modify workspace owner" }, 403);
      }

      // Anti-escalation: Target member's current level check
      if (!isActorOwner) {
        let targetCurrentLevel = 50; // default member
        if (memberToUpdate.roleId) {
          const curRole = await databases.getDocument<Role>(DATABASE_ID, ROLES_ID, memberToUpdate.roleId).catch(() => null);
          if (curRole && curRole.level !== undefined) {
            targetCurrentLevel = curRole.level;
          }
        }
        if (targetCurrentLevel <= profile.role.level) {
          return c.json(
            { error: `Cannot modify member whose rank (${targetCurrentLevel}) is at or above your level (${profile.role.level})` },
            403
          );
        }
      }

      // Anti-escalation: New role check (reject role at or above actor's level)
      if (roleId && !isActorOwner) {
        const targetRole = await databases.getDocument<Role>(DATABASE_ID, ROLES_ID, roleId);
        if (targetRole && targetRole.level <= profile.role.level) {
          return c.json(
            { error: `Cannot assign role of level ${targetRole.level} at or above your level ${profile.role.level}` },
            403
          );
        }
      }
      
      if (allMembersInWorkspace.total === 1 && !isTargetOwner && role && role !== MemberRole.ADMIN) {
        return c.json({ error: "Cannot downgrade the only member" }, 400);
      }

      // Check circular reporting line
      if (reportsToId) {
        if (reportsToId === memberId) {
          return c.json({ error: "Member cannot report to themselves" }, 400);
        }
        const lookupMap = new Map<string, { id: string; reportsToId?: string | null }>();
        for (const m of allMembersInWorkspace.documents) {
          const mId = (m.id || (m as unknown as { $id?: string }).$id) as string;
          const rId = (m as Record<string, unknown>).reportsToId as string | null | undefined;
          lookupMap.set(mId, { id: mId, reportsToId: rId || null });
        }
        if (isReportOf(memberId, reportsToId, lookupMap)) {
          return c.json({ error: "Circular reporting hierarchy detected" }, 400);
        }
      }

      const updateData: Record<string, unknown> = {};
      if (role !== undefined) updateData.role = role;
      if (roleId !== undefined) updateData.roleId = roleId || null;
      if (reportsToId !== undefined) updateData.reportsToId = reportsToId || null;

      await databases.updateDocument(
        DATABASE_ID,
        MEMBERS_ID,
        memberId,
        updateData
      );

      await logPermissionAudit(databases, {
        workspaceId: memberToUpdate.workspaceId,
        actorMemberId: profile.id,
        action: "ASSIGN",
        entityType: "MEMBER_ROLE",
        entityId: memberId,
        oldValues: { roleId: memberToUpdate.roleId, role: memberToUpdate.role },
        newValues: { roleId: roleId || null, role },
      });

      return c.json({ data: { $id: memberToUpdate.$id, ...updateData } });
    }
  );

export default app;
