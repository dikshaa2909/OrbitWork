"use client";

import React, { useState } from "react";
import {
  Key,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveModal } from "@/components/responsive-modal";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS_CATALOG } from "@/lib/permissions/catalog";
import { useGetReviewRequests } from "../api/use-get-review-requests";
import { useGetMyRequests } from "../api/use-get-my-requests";
import { useApproveAccessRequest } from "../api/use-approve-access-request";
import { useDenyAccessRequest } from "../api/use-deny-access-request";
import { useCancelAccessRequest } from "../api/use-cancel-access-request";
import type { AccessRequest } from "../types";

export const AccessRequestsPanel = () => {
  const workspaceId = useWorkspaceId();
  const { isOwner, isAdmin, can } = usePermissions(workspaceId);
  const canReview = isOwner || isAdmin || can("roles:manage");

  const [activeTab, setActiveTab] = useState(canReview ? "incoming" : "mine");

  // Fetch data
  const { data: reviewData, isLoading: isLoadingReview } = useGetReviewRequests({
    workspaceId: workspaceId || "",
  });
  const { data: myData, isLoading: isLoadingMy } = useGetMyRequests({
    workspaceId: workspaceId || "",
  });

  const reviewRequests = (reviewData?.documents || []) as AccessRequest[];
  const myRequests = (myData?.documents || []) as AccessRequest[];

  // Approve dialog state
  const [selectedApproveRequest, setSelectedApproveRequest] = useState<AccessRequest | null>(null);
  const [approveGrantType, setApproveGrantType] = useState<"ONE_TIME" | "TIME_LIMITED" | "PERMANENT">("PERMANENT");
  const [approveDurationHours, setApproveDurationHours] = useState("168"); // 7 days default
  const [approveNote, setApproveNote] = useState("");

  // Deny dialog state
  const [selectedDenyRequest, setSelectedDenyRequest] = useState<AccessRequest | null>(null);
  const [denyNote, setDenyNote] = useState("");

  const { mutate: approveRequest, isPending: isApproving } = useApproveAccessRequest();
  const { mutate: denyRequest, isPending: isDenying } = useDenyAccessRequest();
  const { mutate: cancelRequest, isPending: isCancelling } = useCancelAccessRequest();

  const handleOpenApprove = (req: AccessRequest) => {
    setSelectedApproveRequest(req);
    setApproveGrantType(req.grantType || "PERMANENT");
    setApproveNote("");
  };

  const handleConfirmApprove = () => {
    if (!selectedApproveRequest || !workspaceId) return;
    let expiresAt: string | undefined = undefined;
    if (approveGrantType === "TIME_LIMITED") {
      const d = new Date();
      d.setHours(d.getHours() + parseInt(approveDurationHours, 10));
      expiresAt = d.toISOString();
    }
    approveRequest(
      {
        requestId: selectedApproveRequest.id,
        workspaceId,
        grantType: approveGrantType,
        expiresAt,
        reviewNote: approveNote.trim() || undefined,
      },
      {
        onSuccess: () => setSelectedApproveRequest(null),
      }
    );
  };

  const handleConfirmDeny = () => {
    if (!selectedDenyRequest || !workspaceId) return;
    denyRequest(
      {
        requestId: selectedDenyRequest.id,
        workspaceId,
        reviewNote: denyNote.trim() || undefined,
      },
      {
        onSuccess: () => setSelectedDenyRequest(null),
      }
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/40">Pending</Badge>;
      case "APPROVED":
        return <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40">Approved</Badge>;
      case "DENIED":
        return <Badge variant="outline" className="border-rose-500 text-rose-600 bg-rose-50 dark:bg-rose-950/40">Denied</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">{status}</Badge>;
    }
  };

  const getPermissionLabel = (key: string) => {
    const p = PERMISSIONS_CATALOG.find((item) => item.key === key);
    return p ? `${p.name} (${key})` : key;
  };

  return (
    <div className="w-full space-y-6">
      <Card>
        <CardHeader className="p-6">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center">
              <Key className="size-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Access Requests & Permissions Inbox</CardTitle>
              <CardDescription className="text-xs">
                Review team requests for elevated permissions or check status of your requests.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4">
              {canReview && (
                <TabsTrigger value="incoming" className="text-xs gap-1.5">
                  <ShieldAlert className="size-3.5" />
                  Incoming Requests
                  {reviewRequests.filter((r) => r.status === "PENDING").length > 0 && (
                    <span className="ml-1 rounded-full bg-rose-500 text-white px-1.5 py-0.2 text-[10px] font-bold">
                      {reviewRequests.filter((r) => r.status === "PENDING").length}
                    </span>
                  )}
                </TabsTrigger>
              )}
              <TabsTrigger value="mine" className="text-xs gap-1.5">
                <Clock className="size-3.5" />
                My Requests
                {myRequests.length > 0 && (
                  <span className="ml-1 rounded-full bg-neutral-200 dark:bg-neutral-800 px-1.5 py-0.2 text-[10px] font-medium">
                    {myRequests.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* TAB: INCOMING REQUESTS */}
            {canReview && (
              <TabsContent value="incoming" className="space-y-4">
                {isLoadingReview ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : reviewRequests.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground border rounded-lg border-dashed">
                    No access requests to review at this time.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reviewRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-4 border rounded-xl bg-card hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">
                              {req.requesterName || "Member"}
                            </span>
                            {req.requesterEmail && (
                              <span className="text-xs text-muted-foreground">
                                ({req.requesterEmail})
                              </span>
                            )}
                            {getStatusBadge(req.status)}
                          </div>
                          <div className="text-xs text-neutral-800 dark:text-neutral-200">
                            Requested: <code className="bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded font-mono text-[11px]">{getPermissionLabel(req.permissionKey)}</code>
                          </div>
                          {req.reason && (
                            <p className="text-xs text-muted-foreground italic bg-neutral-50 dark:bg-neutral-900/50 p-2 rounded border border-neutral-100 dark:border-neutral-800">
                              &ldquo;{req.reason}&rdquo;
                            </p>
                          )}
                          <div className="text-[10px] text-muted-foreground">
                            Submitted {formatDistanceToNow(new Date(req.created_at))} ago
                          </div>
                        </div>

                        {req.status === "PENDING" && (
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedDenyRequest(req)}
                              className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                            >
                              <XCircle className="size-3.5 mr-1" />
                              Deny
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleOpenApprove(req)}
                              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                            >
                              <CheckCircle2 className="size-3.5" />
                              Approve
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            )}

            {/* TAB: MY REQUESTS */}
            <TabsContent value="mine" className="space-y-4">
              {isLoadingMy ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : myRequests.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground border rounded-lg border-dashed">
                  You haven&apos;t submitted any access requests in this workspace yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {myRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-4 border rounded-xl bg-card flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded font-mono">
                            {getPermissionLabel(req.permissionKey)}
                          </code>
                          {getStatusBadge(req.status)}
                        </div>
                        {req.reason && (
                          <p className="text-xs text-muted-foreground">
                            Reason: {req.reason}
                          </p>
                        )}
                        {req.reviewNote && (
                          <p className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">
                            Reviewer note: {req.reviewNote}
                          </p>
                        )}
                        <div className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(req.created_at))} ago
                        </div>
                      </div>

                      {req.status === "PENDING" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => cancelRequest({ requestId: req.id, workspaceId })}
                          disabled={isCancelling}
                          className="text-xs text-muted-foreground hover:text-rose-600 self-start md:self-center"
                        >
                          <Trash2 className="size-3.5 mr-1" />
                          Cancel Request
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* APPROVE MODAL */}
      <ResponsiveModal
        open={!!selectedApproveRequest}
        onOpenChange={(open) => !open && setSelectedApproveRequest(null)}
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Approve Permission Grant</h3>
              <p className="text-xs text-muted-foreground">
                Grant permission to {selectedApproveRequest?.requesterName || "member"}
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-semibold block mb-1">Grant Duration Type</label>
              <Select
                value={approveGrantType}
                onValueChange={(v) => setApproveGrantType(v as typeof approveGrantType)}
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERMANENT">Permanent (Until manually revoked)</SelectItem>
                  <SelectItem value="TIME_LIMITED">Time-limited (Expires automatically)</SelectItem>
                  <SelectItem value="ONE_TIME">One-time action (1 use only)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {approveGrantType === "TIME_LIMITED" && (
              <div>
                <label className="text-xs font-semibold block mb-1">Time Limit</label>
                <Select
                  value={approveDurationHours}
                  onValueChange={setApproveDurationHours}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24 hours (1 day)</SelectItem>
                    <SelectItem value="72">72 hours (3 days)</SelectItem>
                    <SelectItem value="168">7 days (1 week)</SelectItem>
                    <SelectItem value="720">30 days (1 month)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold block mb-1">
                Approval Note <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                placeholder="Add instructions or constraints for the member..."
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                className="text-xs min-h-[70px]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedApproveRequest(null)}
              disabled={isApproving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmApprove}
              disabled={isApproving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {isApproving ? "Granting..." : "Confirm & Grant Access"}
            </Button>
          </div>
        </div>
      </ResponsiveModal>

      {/* DENY MODAL */}
      <ResponsiveModal
        open={!!selectedDenyRequest}
        onOpenChange={(open) => !open && setSelectedDenyRequest(null)}
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
              <XCircle className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Deny Permission Request</h3>
              <p className="text-xs text-muted-foreground">
                Deny request from {selectedDenyRequest?.requesterName || "member"}
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-semibold block mb-1">
                Reason for Denial <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                placeholder="Explain why this request is denied..."
                value={denyNote}
                onChange={(e) => setDenyNote(e.target.value)}
                className="text-xs min-h-[70px]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDenyRequest(null)}
              disabled={isDenying}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleConfirmDeny}
              disabled={isDenying}
            >
              {isDenying ? "Denying..." : "Confirm Denial"}
            </Button>
          </div>
        </div>
      </ResponsiveModal>
    </div>
  );
};
