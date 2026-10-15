export type AccessRequestStatus = "PENDING" | "APPROVED" | "DENIED" | "CANCELLED" | "EXPIRED";
export type GrantType = "ONE_TIME" | "TIME_LIMITED" | "PERMANENT";

export interface AccessRequest {
  id: string;
  $id?: string;
  workspaceId: string;
  requesterId: string;
  permissionKey: string;
  resourceType?: string | null;
  resourceId?: string | null;
  reason?: string | null;
  status: AccessRequestStatus;
  reviewerId?: string | null;
  reviewNote?: string | null;
  grantType?: GrantType | null;
  expiresAt?: string | null;
  created_at: string;
  updated_at: string;
  // populated
  requesterName?: string;
  requesterEmail?: string;
  reviewerName?: string;
}

export interface InviteLink {
  id: string;
  $id?: string;
  workspaceId: string;
  roleId?: string | null;
  code: string;
  label?: string | null;
  expiresAt?: string | null;
  maxUses?: number | null;
  uses: number;
  createdBy?: string | null;
  revoked: boolean;
  created_at: string;
  // populated
  roleName?: string;
  roleColor?: string;
}

export interface PermissionGrant {
  id: string;
  $id?: string;
  workspaceId: string;
  memberId: string;
  permissionKey: string;
  resourceType?: string | null;
  resourceId?: string | null;
  grantType: GrantType;
  usesRemaining?: number | null;
  expiresAt?: string | null;
  grantedBy?: string | null;
  requestId?: string | null;
  revoked: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  $id?: string;
  workspaceId: string;
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  read: boolean;
  created_at: string;
}
