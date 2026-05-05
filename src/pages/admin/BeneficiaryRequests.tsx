import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { UserPlus, UserMinus, CheckCircle, XCircle, Clock, Eye } from "lucide-react";
import { toast } from "sonner";

export default function BeneficiaryRequests() {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [showReviewed, setShowReviewed] = useState(false);

  // Load only pending requests by default (fast)
  const { data: pendingRequests = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["beneficiary-requests-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beneficiary_requests")
        .select(`
          id,
          member_id,
          request_type,
          status,
          beneficiary_name,
          beneficiary_relationship,
          beneficiary_phone,
          beneficiary_id,
          reason,
          created_at,
          member:members(name, phone)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Load reviewed requests only when needed (lazy load)
  const { data: reviewedRequests = [], isLoading: reviewedLoading } = useQuery({
    queryKey: ["beneficiary-requests-reviewed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beneficiary_requests")
        .select(`
          id,
          member_id,
          request_type,
          status,
          beneficiary_name,
          admin_notes,
          reviewed_at,
          created_at,
          member:members(name, phone)
        `)
        .neq("status", "pending")
        .order("reviewed_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: showReviewed, // Only load when user wants to see them
  });

  // Load beneficiary details only when viewing a specific request
  const { data: selectedBeneficiary } = useQuery({
    queryKey: ["beneficiary-detail", selectedRequest?.beneficiary_id],
    queryFn: async () => {
      if (!selectedRequest?.beneficiary_id) return null;
      const { data } = await supabase
        .from("beneficiaries")
        .select("name, phone, id_number, relationship")
        .eq("id", selectedRequest.beneficiary_id)
        .single();
      return data;
    },
    enabled: !!selectedRequest?.beneficiary_id,
  });

  const updateRequestStatus = useMutation({
    mutationFn: async ({ 
      requestId, 
      status, 
      notes 
    }: { 
      requestId: string; 
      status: "approved" | "rejected"; 
      notes: string;
    }) => {
      const request = pendingRequests.find(r => r.id === requestId);
      if (!request) throw new Error("Request not found");

      // Update request status
      const { error: updateError } = await supabase
        .from("beneficiary_requests")
        .update({
          status,
          admin_notes: notes,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (updateError) throw updateError;

      // If approved, perform the actual add/remove operation
      if (status === "approved") {
        if (request.request_type === "add") {
          // Add new beneficiary
          const { error: insertError } = await supabase
            .from("beneficiaries")
            .insert({
              member_id: request.member_id,
              name: request.beneficiary_name,
              relationship: request.beneficiary_relationship,
              phone: request.beneficiary_phone,
              id_number: (request as any).beneficiary_id_number,
            });

          if (insertError) throw new Error(`Failed to add beneficiary: ${insertError.message}`);
        } else if (request.request_type === "remove" && request.beneficiary_id) {
          // Remove beneficiary
          const { error: deleteError } = await supabase
            .from("beneficiaries")
            .delete()
            .eq("id", request.beneficiary_id);

          if (deleteError) throw new Error(`Failed to remove beneficiary: ${deleteError.message}`);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["beneficiary-requests-pending"] });
      queryClient.invalidateQueries({ queryKey: ["beneficiary-requests-reviewed"] });
      toast.success("Request updated successfully");
      setSelectedRequest(null);
      setAdminNotes("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update request");
    },
  });

  const handleApprove = () => {
    if (!selectedRequest) return;
    updateRequestStatus.mutate({
      requestId: selectedRequest.id,
      status: "approved",
      notes: adminNotes,
    });
  };

  const handleReject = () => {
    if (!selectedRequest) return;
    if (!adminNotes.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    updateRequestStatus.mutate({
      requestId: selectedRequest.id,
      status: "rejected",
      notes: adminNotes,
    });
  };

  if (pendingLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Beneficiary Requests</h1>
        <p className="text-muted-foreground text-sm">Review and manage member beneficiary requests</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pending</CardTitle>
            <Clock className="h-5 w-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold">{pendingRequests.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Approved</CardTitle>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold">
              {reviewedRequests.filter(r => r.status === "approved").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">Rejected</CardTitle>
            <XCircle className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold">
              {reviewedRequests.filter(r => r.status === "rejected").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {request.request_type === "add" ? (
                        <UserPlus className="h-4 w-4 text-green-500" />
                      ) : (
                        <UserMinus className="h-4 w-4 text-red-500" />
                      )}
                      <span className="font-medium">
                        {request.request_type === "add" ? "Add" : "Remove"} Beneficiary
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {request.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Member:</span> {request.member?.name} ({request.member?.phone})
                    </p>
                    {request.beneficiary_id && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Beneficiary:</span> To be removed
                      </p>
                    )}
                    {request.beneficiary_name && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">New Beneficiary:</span> {request.beneficiary_name} ({request.beneficiary_phone})
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(request.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedRequest(request);
                      setAdminNotes("");
                    }}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Review
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reviewed Requests */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Reviewed Requests</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowReviewed(!showReviewed)}
            >
              {showReviewed ? "Hide" : "Show"} Reviewed ({reviewedRequests.filter(r => r.status === "approved").length + reviewedRequests.filter(r => r.status === "rejected").length})
            </Button>
          </div>
        </CardHeader>
        {showReviewed && (
          <CardContent>
            {reviewedLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : reviewedRequests.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No reviewed requests</p>
            ) : (
              <div className="space-y-3">
                {reviewedRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border border-border rounded-lg"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {request.request_type === "add" ? (
                          <UserPlus className="h-4 w-4 text-green-500" />
                        ) : (
                          <UserMinus className="h-4 w-4 text-red-500" />
                        )}
                        <span className="font-medium">
                          {request.request_type === "add" ? "Add" : "Remove"} Beneficiary
                        </span>
                        <Badge
                          variant={request.status === "approved" ? "default" : "destructive"}
                        >
                          {request.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Member:</span> {request.member?.name}
                      </p>
                      {request.admin_notes && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Admin Notes:</span> {request.admin_notes}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Reviewed: {request.reviewed_at ? new Date(request.reviewed_at).toLocaleString() : "N/A"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {pendingRequests.length === 0 && !showReviewed && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No beneficiary requests yet</p>
          </CardContent>
        </Card>
      )}

      {/* Review Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Review Beneficiary Request</DialogTitle>
            <DialogDescription>
              Review the details and approve or reject this request
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {selectedRequest.request_type === "add" ? (
                    <UserPlus className="h-5 w-5 text-green-500" />
                  ) : (
                    <UserMinus className="h-5 w-5 text-red-500" />
                  )}
                  <h3 className="font-semibold">
                    {selectedRequest.request_type === "add" ? "Add" : "Remove"} Beneficiary Request
                  </h3>
                </div>

                <div className="bg-muted p-3 rounded-lg space-y-2 text-sm">
                  <p>
                    <span className="font-medium">Member:</span> {selectedRequest.member?.name}
                  </p>
                  <p>
                    <span className="font-medium">Phone:</span> {selectedRequest.member?.phone}
                  </p>
                  <p>
                    <span className="font-medium">ID Number:</span> {selectedRequest.member?.id_number}
                  </p>
                </div>

                {selectedRequest.beneficiary_id && selectedBeneficiary && (
                  <div className="bg-muted p-3 rounded-lg space-y-2 text-sm">
                    <p className="font-medium">Existing Beneficiary to Remove:</p>
                    <p>
                      <span className="font-medium">Name:</span> {selectedBeneficiary.name}
                    </p>
                    <p>
                      <span className="font-medium">Relationship:</span> <span className="capitalize">{selectedBeneficiary.relationship}</span>
                    </p>
                    <p>
                      <span className="font-medium">Phone:</span> {selectedBeneficiary.phone || "N/A"}
                    </p>
                  </div>
                )}

                {selectedRequest.beneficiary_name && (
                  <div className="bg-muted p-3 rounded-lg space-y-2 text-sm">
                    <p className="font-medium">New Beneficiary Details:</p>
                    <p>
                      <span className="font-medium">Name:</span> {selectedRequest.beneficiary_name}
                    </p>
                    <p>
                      <span className="font-medium">Phone:</span> {selectedRequest.beneficiary_phone}
                    </p>
                    <p>
                      <span className="font-medium">Relationship:</span> {selectedRequest.beneficiary_relationship}
                    </p>
                  </div>
                )}

                <div className="bg-muted p-3 rounded-lg space-y-2 text-sm">
                  <p className="font-medium">Member's Reason:</p>
                  <p className="whitespace-pre-wrap">{selectedRequest.reason}</p>
                </div>

                <p className="text-xs text-muted-foreground">
                  Submitted: {new Date(selectedRequest.created_at).toLocaleString()}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Admin Notes</label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this decision (required for rejection)"
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleApprove}
                  disabled={updateRequestStatus.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={updateRequestStatus.isPending}
                  variant="destructive"
                  className="flex-1"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
