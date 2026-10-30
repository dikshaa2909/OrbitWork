import { Hono, Context } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

import { sessionMiddleware } from "@/lib/session-middleware";
import {
  DATABASE_ID,
  CHANNELS_ID,
  CHANNEL_MEMBERS_ID,
  MESSAGES_ID,
  MESSAGE_REACTIONS_ID,
  TASKS_ID,
  MEMBERS_ID,
} from "@/config";
import { ID, Query, getAdminDatabases } from "@/lib/supabase";
import { can } from "@/lib/permissions/engine";
import { getMemberPermissionProfile } from "@/lib/permissions/server";
import {
  createChannelSchema,
  createMessageSchema,
  toggleReactionSchema,
  Channel,
  ChannelMember,
  Message,
  MessageReaction,
} from "../types";

const deny = (c: Context, key: string) =>
  c.json(
    {
      error: `Forbidden: '${key}' permission required`,
      requiredPermission: key,
      canRequest: true,
    },
    403
  );

const app = new Hono()
  // ===========================================================================
  // 1. List Channels for Workspace (Joined channels + Workspace public channels)
  // ===========================================================================
  .get(
    "/channels",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        workspaceId: z.string().trim().min(1),
      })
    ),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { workspaceId } = c.req.valid("query");

      const profile = await getMemberPermissionProfile(
        databases,
        workspaceId,
        user.$id
      );
      if (!profile) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const adminDatabases = getAdminDatabases("chat:list-channels");

      try {
        // Find all channel memberships for current user
        const memberDocs = await adminDatabases.listDocuments<ChannelMember>(
          DATABASE_ID,
          CHANNEL_MEMBERS_ID,
          [Query.equal("member_id", user.$id)]
        );

        const joinedChannelIds = new Set(
          memberDocs.documents.map((m) => m.channel_id)
        );

        // Fetch all channels in workspace
        const allChannels = await adminDatabases.listDocuments<Channel>(
          DATABASE_ID,
          CHANNELS_ID,
          [
            Query.equal("workspace_id", workspaceId),
            Query.equal("is_archived", false),
            Query.orderAsc("created_at"),
          ]
        );

        const canViewAll = can(profile, "chat:channels.view_all");

        // Filter: user sees:
        // 1. Any channel where they are an explicit member
        // 2. Any WORKSPACE public channel
        // 3. If they have chat:channels.view_all, PROJECT/TEAM channels (BUT NEVER DMs)
        const visibleChannels: Channel[] = [];

        for (const ch of allChannels.documents) {
          const isMember = joinedChannelIds.has(ch.id);

          if (ch.type === "DM") {
            // Strictly direct participants only
            if (isMember) {
              visibleChannels.push(ch);
            }
          } else if (isMember || ch.type === "WORKSPACE") {
            visibleChannels.push(ch);
          } else if (
            canViewAll &&
            (ch.type === "PROJECT" || ch.type === "TEAM")
          ) {
            visibleChannels.push(ch);
          }
        }

        // Batch populate DM partner details (eliminates N+1 queries)
        const dmChannels = visibleChannels.filter((ch) => ch.type === "DM");
        const partnerMap = new Map<string, { id: string; name: string; email: string }>();

        if (dmChannels.length > 0) {
          const dmChannelIds = dmChannels.map((ch) => ch.id);
          const allDmMembers = await adminDatabases.listDocuments<ChannelMember>(
            DATABASE_ID,
            CHANNEL_MEMBERS_ID,
            [Query.contains("channel_id", dmChannelIds)]
          );

          // Find the partner user IDs for each DM channel
          const partnerUserIds = new Set<string>();
          const channelToPartnerUserId = new Map<string, string>();

          for (const m of allDmMembers.documents) {
            if (m.member_id !== user.$id) {
              partnerUserIds.add(m.member_id);
              channelToPartnerUserId.set(m.channel_id, m.member_id);
            }
          }

          if (partnerUserIds.size > 0) {
            const partnerProfiles = await adminDatabases.listDocuments<{
              userId: string;
              name?: string;
              email?: string;
            }>(DATABASE_ID, MEMBERS_ID, [
              Query.equal("workspaceId", workspaceId),
              Query.contains("userId", Array.from(partnerUserIds)),
            ]);

            const profileByUserId = new Map<string, { name: string; email: string }>();
            for (const p of partnerProfiles.documents) {
              profileByUserId.set(p.userId, {
                name: p.name || p.email || "Teammate",
                email: p.email || "",
              });
            }

            channelToPartnerUserId.forEach((partnerUserId, channelId) => {
              const prof = profileByUserId.get(partnerUserId);
              if (prof) {
                partnerMap.set(channelId, {
                  id: partnerUserId,
                  name: prof.name,
                  email: prof.email,
                });
              }
            });
          }
        }

        const enrichedChannels = visibleChannels.map((ch) => {
          if (ch.type === "DM") {
            const partner = partnerMap.get(ch.id);
            return {
              ...ch,
              name: partner?.name || partner?.email || "Direct Message",
              dm_partner: partner || null,
            };
          }
          return ch;
        });

        return c.json({ data: enrichedChannels });
      } catch (err: unknown) {
        console.error("Error listing channels:", err);
        return c.json({ data: [] });
      }
    }
  )

  // ===========================================================================
  // 2. Create Channel / Direct Message
  // ===========================================================================
  .post(
    "/channels",
    sessionMiddleware,
    zValidator("json", createChannelSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const {
        workspaceId,
        type,
        name,
        description,
        projectId,
        teamId,
        recipientMemberId,
      } = c.req.valid("json");

      const profile = await getMemberPermissionProfile(
        databases,
        workspaceId,
        user.$id
      );
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      // Permission checks
      if (type === "DM") {
        if (!can(profile, "chat:dm")) {
          return deny(c, "chat:dm");
        }
        if (!recipientMemberId) {
          return c.json(
            { error: "recipientMemberId is required for direct messages" },
            400
          );
        }
      } else {
        if (!can(profile, "chat:channels.create")) {
          return deny(c, "chat:channels.create");
        }
      }

      const adminDatabases = getAdminDatabases("chat:create-channel");

      // Check if DM already exists between these 2 users (batch lookup)
      if (type === "DM" && recipientMemberId) {
        const myDMs = await adminDatabases.listDocuments<ChannelMember>(
          DATABASE_ID,
          CHANNEL_MEMBERS_ID,
          [Query.equal("member_id", user.$id)]
        );

        const myChannelIds = myDMs.documents.map((dm) => dm.channel_id);

        if (myChannelIds.length > 0) {
          const sharedMemberships = await adminDatabases.listDocuments<ChannelMember>(
            DATABASE_ID,
            CHANNEL_MEMBERS_ID,
            [
              Query.equal("member_id", recipientMemberId),
              Query.contains("channel_id", myChannelIds),
            ]
          );

          if (sharedMemberships.documents.length > 0) {
            for (const shared of sharedMemberships.documents) {
              const channel = await adminDatabases
                .getDocument<Channel>(DATABASE_ID, CHANNELS_ID, shared.channel_id)
                .catch(() => null);

              if (channel && channel.type === "DM" && channel.workspace_id === workspaceId) {
                return c.json({ data: channel });
              }
            }
          }
        }
      }

      const channelId = ID.unique();
      const newChannel = await adminDatabases.createDocument<Channel>(
        DATABASE_ID,
        CHANNELS_ID,
        channelId,
        {
          id: channelId,
          workspace_id: workspaceId,
          type,
          name: name || (type === "DM" ? "Direct Message" : "New Channel"),
          description: description || null,
          project_id: projectId || null,
          team_id: teamId || null,
          created_by: user.$id,
          is_archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      );

      // Add creator as OWNER
      await adminDatabases.createDocument<ChannelMember>(
        DATABASE_ID,
        CHANNEL_MEMBERS_ID,
        ID.unique(),
        {
          channel_id: channelId,
          member_id: user.$id,
          role: "OWNER",
          joined_at: new Date().toISOString(),
        }
      );

      // If DM, add recipient as MEMBER
      if (type === "DM" && recipientMemberId) {
        await adminDatabases.createDocument<ChannelMember>(
          DATABASE_ID,
          CHANNEL_MEMBERS_ID,
          ID.unique(),
          {
            channel_id: channelId,
            member_id: recipientMemberId,
            role: "MEMBER",
            joined_at: new Date().toISOString(),
          }
        );
      }

      return c.json({ data: newChannel });
    }
  )

  // ===========================================================================
  // 3. Get Messages for Channel (Cursor pagination & threads)
  // ===========================================================================
  .get(
    "/channels/:channelId/messages",
    sessionMiddleware,
    zValidator(
      "query",
      z.object({
        limit: z.coerce.number().min(1).max(100).default(50),
        parentMessageId: z.string().optional(),
      })
    ),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { channelId } = c.req.param();
      const { limit, parentMessageId } = c.req.valid("query");

      const adminDatabases = getAdminDatabases("chat:get-messages");

      const channel = await adminDatabases
        .getDocument<Channel>(DATABASE_ID, CHANNELS_ID, channelId)
        .catch(() => null);

      if (!channel) {
        return c.json({ error: "Channel not found" }, 404);
      }

      // Authorization verification
      const profile = await getMemberPermissionProfile(
        databases,
        channel.workspace_id,
        user.$id
      );
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      const membership = await adminDatabases.listDocuments<ChannelMember>(
        DATABASE_ID,
        CHANNEL_MEMBERS_ID,
        [
          Query.equal("channel_id", channelId),
          Query.equal("member_id", user.$id),
        ]
      );

      const isMember = membership.documents.length > 0;

      if (channel.type === "DM" && !isMember) {
        return c.json({ error: "Forbidden: Not a participant of this direct message" }, 403);
      }

      if (
        !isMember &&
        channel.type !== "WORKSPACE" &&
        !can(profile, "chat:channels.view_all")
      ) {
        return c.json({ error: "Forbidden: Not a member of this channel" }, 403);
      }

      // Query messages
      const queries = [
        Query.equal("channel_id", channelId),
        Query.orderDesc("created_at"),
        Query.limit(limit),
      ];

      if (parentMessageId) {
        queries.push(Query.equal("parent_message_id", parentMessageId));
      }

      const messagesDoc = await adminDatabases.listDocuments<Message>(
        DATABASE_ID,
        MESSAGES_ID,
        queries
      );

      // Fetch reactions & authors
      const messageIds = messagesDoc.documents.map((m) => m.id);

      const reactions =
        messageIds.length > 0
          ? await adminDatabases.listDocuments<MessageReaction>(
              DATABASE_ID,
              MESSAGE_REACTIONS_ID,
              [Query.contains("message_id", messageIds)]
            )
          : { documents: [] };

      // Map reactions by message
      const reactionsByMsg = new Map<string, MessageReaction[]>();
      for (const r of reactions.documents) {
        const list = reactionsByMsg.get(r.message_id) || [];
        list.push(r);
        reactionsByMsg.set(r.message_id, list);
      }

      // Fetch author profiles
      const authorIds = Array.from(
        new Set(messagesDoc.documents.map((m) => m.author_id))
      );
      const authors = await adminDatabases.listDocuments<{
        userId: string;
        name?: string;
        email?: string;
      }>(DATABASE_ID, MEMBERS_ID, [
        Query.equal("workspaceId", channel.workspace_id),
        Query.contains("userId", authorIds),
      ]);

      const authorMap = new Map<string, { name: string; email: string }>();
      for (const a of authors.documents) {
        authorMap.set(a.userId, {
          name: a.name || a.email || "Teammate",
          email: a.email || "",
        });
      }

      const enrichedMessages: Message[] = messagesDoc.documents
        .map((m) => ({
          ...m,
          author_name: authorMap.get(m.author_id)?.name || "Teammate",
          author_email: authorMap.get(m.author_id)?.email || "",
          reactions: reactionsByMsg.get(m.id) || [],
        }))
        .reverse(); // ascending order for display

      return c.json({ data: enrichedMessages });
    }
  )

  // ===========================================================================
  // 4. Post Message to Channel
  // ===========================================================================
  .post(
    "/channels/:channelId/messages",
    sessionMiddleware,
    zValidator("json", createMessageSchema),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { channelId } = c.req.param();
      const { body, parentMessageId, taskId } = c.req.valid("json");

      const adminDatabases = getAdminDatabases("chat:create-message");

      const channel = await adminDatabases
        .getDocument<Channel>(DATABASE_ID, CHANNELS_ID, channelId)
        .catch(() => null);

      if (!channel) return c.json({ error: "Channel not found" }, 404);

      const profile = await getMemberPermissionProfile(
        databases,
        channel.workspace_id,
        user.$id
      );
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      // Check membership
      const membership = await adminDatabases.listDocuments<ChannelMember>(
        DATABASE_ID,
        CHANNEL_MEMBERS_ID,
        [
          Query.equal("channel_id", channelId),
          Query.equal("member_id", user.$id),
        ]
      );

      const isMember = membership.documents.length > 0;

      if (channel.type === "DM" && !isMember) {
        return c.json({ error: "Forbidden: Not in this DM" }, 403);
      }

      // If workspace channel and not joined, auto-join
      if (channel.type === "WORKSPACE" && !isMember) {
        await adminDatabases.createDocument<ChannelMember>(
          DATABASE_ID,
          CHANNEL_MEMBERS_ID,
          ID.unique(),
          {
            channel_id: channelId,
            member_id: user.$id,
            role: "MEMBER",
            joined_at: new Date().toISOString(),
          }
        );
      }

      const messageId = ID.unique();
      const newMessage = await adminDatabases.createDocument<Message>(
        DATABASE_ID,
        MESSAGES_ID,
        messageId,
        {
          id: messageId,
          channel_id: channelId,
          author_id: user.$id,
          parent_message_id: parentMessageId || null,
          body,
          task_id: taskId || null,
          created_at: new Date().toISOString(),
        }
      );

      return c.json({
        data: {
          ...newMessage,
          author_name: user.name || user.email || "Me",
          author_email: user.email || "",
          reactions: [],
        },
      });
    }
  )

  // ===========================================================================
  // 5. Toggle Reaction on Message
  // ===========================================================================
  .post(
    "/messages/:messageId/reactions",
    sessionMiddleware,
    zValidator("json", toggleReactionSchema),
    async (c) => {
      const user = c.get("user");
      const { messageId } = c.req.param();
      const { emoji } = c.req.valid("json");

      const adminDatabases = getAdminDatabases("chat:toggle-reaction");

      const message = await adminDatabases
        .getDocument<Message>(DATABASE_ID, MESSAGES_ID, messageId)
        .catch(() => null);

      if (!message) return c.json({ error: "Message not found" }, 404);

      // Check if user already added this reaction
      const existing = await adminDatabases.listDocuments<MessageReaction>(
        DATABASE_ID,
        MESSAGE_REACTIONS_ID,
        [
          Query.equal("message_id", messageId),
          Query.equal("member_id", user.$id),
          Query.equal("emoji", emoji),
        ]
      );

      if (existing.documents.length > 0) {
        // Toggle OFF (delete reaction)
        await adminDatabases.deleteDocument(
          DATABASE_ID,
          MESSAGE_REACTIONS_ID,
          existing.documents[0].id
        );
        return c.json({ data: { messageId, emoji, active: false } });
      }

      // Toggle ON (create reaction)
      const reactionId = ID.unique();
      const newReaction = await adminDatabases.createDocument<MessageReaction>(
        DATABASE_ID,
        MESSAGE_REACTIONS_ID,
        reactionId,
        {
          id: reactionId,
          message_id: messageId,
          member_id: user.$id,
          emoji,
          created_at: new Date().toISOString(),
        }
      );

      return c.json({ data: { ...newReaction, active: true } });
    }
  )

  // ===========================================================================
  // 6. Convert Message to Task Draft
  // ===========================================================================
  .post(
    "/messages/:messageId/convert-to-task",
    sessionMiddleware,
    zValidator(
      "json",
      z.object({
        projectId: z.string().trim().min(1, "Project ID is required"),
        title: z.string().optional(),
      })
    ),
    async (c) => {
      const user = c.get("user");
      const databases = c.get("databases");
      const { messageId } = c.req.param();
      const { projectId, title } = c.req.valid("json");

      const adminDatabases = getAdminDatabases("chat:convert-to-task");

      const message = await adminDatabases
        .getDocument<Message>(DATABASE_ID, MESSAGES_ID, messageId)
        .catch(() => null);

      if (!message) return c.json({ error: "Message not found" }, 404);

      const channel = await adminDatabases.getDocument<Channel>(
        DATABASE_ID,
        CHANNELS_ID,
        message.channel_id
      );

      const profile = await getMemberPermissionProfile(
        databases,
        channel.workspace_id,
        user.$id
      );
      if (!profile) return c.json({ error: "Unauthorized" }, 401);

      if (!can(profile, "tasks:create", { projectId })) {
        return deny(c, "tasks:create");
      }

      // Generate task from message
      const taskId = ID.unique();
      const taskName =
        title?.trim() ||
        message.body.slice(0, 60).replace(/<[^>]*>/g, "") ||
        "Converted Task from Chat";

      const newTask = await adminDatabases.createDocument(
        DATABASE_ID,
        TASKS_ID,
        taskId,
        {
          id: taskId,
          name: taskName,
          workspaceId: channel.workspace_id,
          projectId,
          description: message.body,
          status: "TODO",
          assigneeId: user.$id,
          position: 1000,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      );

      // Link task to message
      await adminDatabases.updateDocument(
        DATABASE_ID,
        MESSAGES_ID,
        messageId,
        {
          task_id: taskId,
        }
      );

      return c.json({ data: newTask });
    }
  );

export default app;

