import "server-only";

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/features/auth/constants";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";
export const getSupabaseServiceRoleKey = (): string => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. Server admin operations require the service role key."
    );
  }
  return key;
};

export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export type AuthUser = {
  $id: string;
  id: string;
  name: string;
  email: string;
};

export type QueryFilter = {
  method:
    | "equal"
    | "notEqual"
    | "contains"
    | "greaterThanEqual"
    | "lessThanEqual"
    | "lessThan"
    | "orderDesc"
    | "orderAsc"
    | "search"
    | "limit";
  attribute?: string;
  values?: unknown[];
};

export const ID = {
  unique: () => crypto.randomUUID(),
};

export const Query = {
  equal: (attribute: string, value: unknown): QueryFilter => ({
    method: "equal",
    attribute,
    values: [value],
  }),
  notEqual: (attribute: string, value: unknown): QueryFilter => ({
    method: "notEqual",
    attribute,
    values: [value],
  }),
  contains: (attribute: string, values: unknown[]): QueryFilter => ({
    method: "contains",
    attribute,
    values,
  }),
  greaterThanEqual: (attribute: string, value: unknown): QueryFilter => ({
    method: "greaterThanEqual",
    attribute,
    values: [value],
  }),
  lessThanEqual: (attribute: string, value: unknown): QueryFilter => ({
    method: "lessThanEqual",
    attribute,
    values: [value],
  }),
  lessThan: (attribute: string, value: unknown): QueryFilter => ({
    method: "lessThan",
    attribute,
    values: [value],
  }),
  orderDesc: (attribute: string): QueryFilter => ({
    method: "orderDesc",
    attribute,
  }),
  orderAsc: (attribute: string): QueryFilter => ({
    method: "orderAsc",
    attribute,
  }),
  search: (attribute: string, value: string): QueryFilter => ({
    method: "search",
    attribute,
    values: [value],
  }),
  limit: (limit: number): QueryFilter => ({
    method: "limit",
    values: [limit],
  }),
};

export type DocumentModel = {
  id: string;
  created_at: string;
  updated_at: string;
  $id: string;
  $createdAt: string;
  $updatedAt: string;
};

export type UserModel<T = Record<string, unknown>> = {
  $id: string;
  id: string;
  name: string;
  email: string;
  prefs?: T;
};

export type PreferencesModel = Record<string, unknown>;

export function parseAuthCookie(cookieValue?: string | null): {
  accessToken?: string;
  refreshToken?: string;
} {
  if (!cookieValue) return {};
  try {
    const parsed = JSON.parse(cookieValue);
    if (parsed && typeof parsed === "object") {
      return {
        accessToken: parsed.access_token || parsed.accessToken,
        refreshToken: parsed.refresh_token || parsed.refreshToken,
      };
    }
  } catch {
    // String token
  }
  return { accessToken: cookieValue };
}

export function getSupabaseClient(accessToken?: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
}

export function getSupabaseAdminClient(): SupabaseClient {
  const serviceRoleKey = getSupabaseServiceRoleKey();
  return createClient(SUPABASE_URL, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function getAuthenticatedUser(
  accessToken?: string,
  refreshToken?: string
): Promise<{ user: AuthUser; session?: unknown } | null> {
  if (!accessToken) return null;

  try {
    const client = getSupabaseClient(accessToken);
    const { data, error } = await client.auth.getUser(accessToken);
    let user = data?.user;

    if ((error || !user) && refreshToken) {
      const refreshRes = await client.auth.refreshSession({
        refresh_token: refreshToken,
      });
      if (refreshRes.data?.session && refreshRes.data?.user) {
        user = refreshRes.data.user;
        return {
          user: {
            $id: user.id,
            id: user.id,
            name:
              user.user_metadata?.name ||
              user.user_metadata?.full_name ||
              user.email?.split("@")[0] ||
              "",
            email: user.email || "",
          },
          session: refreshRes.data.session,
        };
      }
    }

    if (!user) return null;

    return {
      user: {
        $id: user.id,
        id: user.id,
        name:
          user.user_metadata?.name ||
          user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          "",
        email: user.email || "",
      },
    };
  } catch {
    return null;
  }
}

function mapAttribute(attr?: string): string {
  if (!attr) return "";
  if (attr === "$id") return "id";
  if (attr === "$createdAt") return "created_at";
  if (attr === "$updatedAt") return "updated_at";
  return attr;
}

export function toDocument<T = Record<string, unknown>>(row: unknown): T {
  if (!row || typeof row !== "object") return row as T;
  const record = row as Record<string, unknown>;
  const id = (record.id as string) || (record.$id as string) || "";
  const createdAt =
    (record.created_at as string) ||
    (record.$createdAt as string) ||
    new Date().toISOString();
  const updatedAt =
    (record.updated_at as string) ||
    (record.$updatedAt as string) ||
    new Date().toISOString();

  return {
    ...record,
    id,
    $id: id,
    created_at: createdAt,
    $createdAt: createdAt,
    updated_at: updatedAt,
    $updatedAt: updatedAt,
    imageUrl: (record.imageUrl as string) ?? (record.image_url as string) ?? undefined,
    inviteCode: (record.inviteCode as string) ?? (record.invite_code as string) ?? undefined,
    userId: (record.userId as string) ?? (record.user_id as string) ?? undefined,
    workspaceId: (record.workspaceId as string) ?? (record.workspace_id as string) ?? undefined,
    projectId: (record.projectId as string) ?? (record.project_id as string) ?? undefined,
    assigneeId: (record.assigneeId as string) ?? (record.assignee_id as string) ?? undefined,
    dueDate: (record.dueDate as string) ?? (record.due_date as string) ?? undefined,
  } as T;
}

function cleanPayload(data: Record<string, unknown>) {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("$")) continue;
    cleaned[key] = value;
  }
  return cleaned;
}

export const createDatabasesClient = (client: SupabaseClient) => {
  return {
    async listDocuments<T = Record<string, unknown>>(
      databaseId: string,
      table: string,
      queries: QueryFilter[] = []
    ): Promise<{ documents: T[]; total: number }> {
      let query = client.from(table).select("*", { count: "exact" });

      for (const q of queries) {
        if (!q) continue;
        const attr = mapAttribute(q.attribute);

        switch (q.method) {
          case "equal":
            query = query.eq(attr, q.values![0]);
            break;
          case "notEqual":
            query = query.neq(attr, q.values![0]);
            break;
          case "contains":
            if (!q.values || q.values.length === 0) {
              return { documents: [], total: 0 };
            }
            query = query.in(attr, q.values);
            break;
          case "greaterThanEqual":
            query = query.gte(attr, q.values![0]);
            break;
          case "lessThanEqual":
            query = query.lte(attr, q.values![0]);
            break;
          case "lessThan":
            query = query.lt(attr, q.values![0]);
            break;
          case "orderDesc":
            query = query.order(attr, { ascending: false });
            break;
          case "orderAsc":
            query = query.order(attr, { ascending: true });
            break;
          case "search":
            query = query.ilike(attr, `%${String(q.values![0])}%`);
            break;
          case "limit":
            query = query.limit(Number(q.values![0]));
            break;
        }
      }

      const { data, count, error } = await query;
      if (error) {
        console.error(`Error querying ${table}:`, error.message);
        throw new Error(error.message);
      }

      const documents = (data || []).map((row) => toDocument<T>(row));
      return {
        documents,
        total: count ?? documents.length,
      };
    },

    async getDocument<T = Record<string, unknown>>(
      databaseId: string,
      table: string,
      id: string
    ): Promise<T> {
      const { data, error } = await client
        .from(table)
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        throw new Error(error?.message || `Document ${id} not found in ${table}`);
      }

      return toDocument<T>(data);
    },

    async createDocument<T = Record<string, unknown>>(
      databaseId: string,
      table: string,
      id: string,
      docData: Record<string, unknown>
    ): Promise<T> {
      const insertPayload = cleanPayload({
        id: id || crypto.randomUUID(),
        ...docData,
      });

      const { data, error } = await client
        .from(table)
        .insert(insertPayload)
        .select()
        .single();

      if (error || !data) {
        console.error(`Error inserting into ${table}:`, error);
        throw new Error(error?.message || `Failed to create document in ${table}`);
      }

      return toDocument<T>(data);
    },

    async updateDocument<T = Record<string, unknown>>(
      databaseId: string,
      table: string,
      id: string,
      docData: Record<string, unknown>
    ): Promise<T> {
      const updatePayload = cleanPayload({
        ...docData,
        updated_at: new Date().toISOString(),
      });

      const { data, error } = await client
        .from(table)
        .update(updatePayload)
        .eq("id", id)
        .select()
        .single();

      if (error || !data) {
        console.error(`Error updating in ${table}:`, error);
        throw new Error(error?.message || `Failed to update document in ${table}`);
      }

      return toDocument<T>(data);
    },

    async deleteDocument(
      databaseId: string,
      table: string,
      id: string
    ): Promise<{ $id: string }> {
      const { error } = await client.from(table).delete().eq("id", id);

      if (error) {
        console.error(`Error deleting from ${table}:`, error);
        throw new Error(error.message);
      }

      return { $id: id };
    },

    async rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
      const { data, error } = await client.rpc(fn, args);
      if (error) {
        console.error(`Error calling RPC ${fn}:`, error.message);
        throw new Error(error.message);
      }
      return data as T;
    },
  };
};

export function getAdminDatabases(reason?: string): Databases {
  void reason;
  const adminClient = getSupabaseAdminClient();
  return createDatabasesClient(adminClient);
}

const fileBuffersCache = new Map<string, Buffer>();

export const createStorageClient = (client: SupabaseClient) => {
  return {
    async createFile(bucketId: string, fileId: string, file: File) {
      const ext = file.name ? file.name.split(".").pop() : "png";
      const fileName = `${fileId}.${ext}`;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fileBuffersCache.set(fileName, buffer);
      fileBuffersCache.set(fileId, buffer);

      try {
        await client.storage.from(bucketId).upload(fileName, buffer, {
          contentType: file.type || "image/png",
          upsert: true,
        });
      } catch (err) {
        console.warn("Storage upload notice:", err);
      }

      return {
        $id: fileName,
        id: fileName,
      };
    },

    getFileUrl(bucketId: string, fileId: string): string {
      const { data } = client.storage.from(bucketId).getPublicUrl(fileId);
      return data.publicUrl;
    },

    async getFilePreview(bucketId: string, fileId: string): Promise<ArrayBuffer> {
      if (fileBuffersCache.has(fileId)) {
        return fileBuffersCache.get(fileId)!.buffer as ArrayBuffer;
      }

      try {
        const { data } = await client.storage.from(bucketId).download(fileId);
        if (data) {
          return await data.arrayBuffer();
        }
      } catch {
        // Fallback
      }

      return new ArrayBuffer(0);
    },
  };
};

export const createUsersClient = (client: SupabaseClient) => {
  return {
    async get(userId: string) {
      try {
        const { data } = await client.auth.admin.getUserById(userId);
        if (data?.user) {
          return {
            $id: data.user.id,
            id: data.user.id,
            name:
              data.user.user_metadata?.name ||
              data.user.user_metadata?.full_name ||
              data.user.email?.split("@")[0] ||
              "Member",
            email: data.user.email || "",
          };
        }
      } catch {
        // fallback
      }
      return {
        $id: userId,
        id: userId,
        name: "Member",
        email: "",
      };
    },
  };
};

export type Databases = ReturnType<typeof createDatabasesClient>;
export type Storage = ReturnType<typeof createStorageClient>;
export type Users = ReturnType<typeof createUsersClient>;
export type Account = {
  get: () => Promise<AuthUser>;
  deleteSession: (sessionId: string) => Promise<void>;
};

export async function createSessionClient() {
  const sessionCookie = cookies().get(AUTH_COOKIE)?.value;

  if (!sessionCookie) {
    throw new Error("Unauthorized");
  }

  const { accessToken, refreshToken } = parseAuthCookie(sessionCookie);
  const auth = await getAuthenticatedUser(accessToken, refreshToken);

  if (!auth) {
    throw new Error("Unauthorized");
  }

  const client = getSupabaseAdminClient();

  return {
    get account(): Account {
      return {
        async get() {
          return auth.user;
        },
        async deleteSession() {
          // Cookie cleared on route
        },
      };
    },
    get databases() {
      return createDatabasesClient(client);
    },
    get storage() {
      return createStorageClient(client);
    },
  };
}

export async function createAdminClient() {
  const client = getSupabaseAdminClient();

  return {
    get account() {
      return {
        async create(
          userId: string,
          email: string,
          password: string,
          name: string
        ) {
          const { data, error } = await client.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name },
          });
          if (error) throw error;
          return data.user;
        },
        async createEmailPasswordSession(email: string, password: string) {
          const anonClient = getSupabaseClient();
          const { data, error } = await anonClient.auth.signInWithPassword({
            email,
            password,
          });
          if (error || !data.session) {
            throw error || new Error("Failed to authenticate");
          }
          return {
            secret: JSON.stringify({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            }),
          };
        },
        async deleteSession() {
          // Handled on logout
        },
      };
    },
    get users() {
      return createUsersClient(client);
    },
    get databases() {
      return createDatabasesClient(client);
    },
    get storage() {
      return createStorageClient(client);
    },
  };
}
