import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
const supabase: any = supabaseClient;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Eye, CheckCircle, XCircle, Clock, FileText, User, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

interface MinuteDetails {
  id: string;
  title: string;
  meeting_date: string;
  meeting_type: string;
  agenda: string;
  discussions: string;
  decisions: string;
  action_items: string;
  attendees: string[];
  status: string;
  created_by: string;
  created_at: string;
  submitted_at: string;
  creator_name?: string;
}

export default function MinutesReview() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedMinute, setSelectedMinute] = useState<MinuteDetails | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  // Fetch minutes pending secretary review
  const { data: pendingMinutes, isLoading } = useQuery({
    queryKey: ["secretary-pending-minutes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_minutes")
        .select(`
          *,
          creator:created_by (
            email
          )
        `)
        .eq("status", "submitted_to_secretary")
        .order("submitted_at", { ascending: true });

      if (error) throw error;

      return data?.map(minute => ({
        ...minute,
        creator_name: minute.creator?.email || "Unknown"
      })) || [];
    },
  });

  // Approve and forward to chairperson — auto-prefill secretary signature & name
  const approveMutation = useMutation({
    mutationFn: async ({ minuteId, notes }: { minuteId: string; notes: string }) => {
      // Look up the secretary's stored signature
      const { data: sigRow } = await supabase
        .from("office_bearer_signatures")
        .select("signature_url")
        .eq("role", "secretary")
        .maybeSingle();

      // Look up the secretary's display name from members
      let secretaryName: string | null = null;
      if (user?.id) {
        const { data: memberRow } = await supabase
          .from("members")
          .select("name")
          .eq("user_id", user.id)
          .maybeSingle();
        secretaryName = memberRow?.name || user.email || null;
      }

      const updatePayload: any = {
        status: "secretary_reviewed",
        secretary_reviewed_by: user?.id,
        secretary_reviewed_at: new Date().toISOString(),
        secretary_notes: notes,
        updated_at: new Date().toISOString(),
      };
      if (sigRow?.signature_url) updatePayload.secretary_signature_url = sigRow.signature_url;
      if (secretaryName) updatePayload.secretary_name = secretaryName;

      const { error } = await supabase
        .from("meeting_minutes")
        .update(updatePayload)
        .eq("id", minuteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["secretary-pending-minutes"] });
      toast.success("Minutes approved and forwarded to Chairperson");
      setSelectedMinute(null);
      setReviewNotes("");
      setViewDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Failed to approve minutes: " + error.message);
    },
  });

  // Reject and send back to vice secretary
  const rejectMutation = useMutation({
    mutationFn: async ({ minuteId, notes }: { minuteId: string; notes: string }) => {
      const { error } = await supabase
        .from("meeting_minutes")
        .update({
          status: "rejected_by_secretary",
          secretary_reviewed_by: user?.id,
          secretary_reviewed_at: new Date().toISOString(),
          secretary_notes: notes,
          updated_at: new Date().toISOString()
        })
        .eq("id", minuteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["secretary-pending-minutes"] });
      toast.success("Minutes rejected and sent back to Vice Secretary");
      setSelectedMinute(null);
      setReviewNotes("");
      setViewDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Failed to reject minutes: " + error.message);
    },
  });

  const handleApprove = () => {
    if (!selectedMinute) return;
    approveMutation.mutate({ 
      minuteId: selectedMinute.id, 
      notes: reviewNotes 
    });
  };

  const handleReject = () => {
    if (!selectedMinute || !reviewNotes.trim()) {
      toast.error("Please provide feedback notes for rejection");
      return;
    }
    rejectMutation.mutate({ 
      minuteId: selectedMinute.id, 
      notes: reviewNotes 
    });
  };

  const openViewDialog = (minute: MinuteDetails) => {
    setSelectedMinute(minute);
    setReviewNotes("");
    setViewDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "submitted_to_secretary":
        return <Badge variant="outline" className="text-orange-600 border-orange-600"><Clock className="h-3 w-3 mr-1" />Pending Review</Badge>;
      case "secretary_reviewed":
        return <Badge variant="outline" className="text-blue-600 border-blue-600"><CheckCircle className="h-3 w-3 mr-1" />Forwarded</Badge>;
      case "rejected_by_secretary":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading minutes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Minutes Review</h1>
          <p className="text-muted-foreground mt-1">Review minutes submitted by Vice Secretary</p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {pendingMinutes?.length || 0} Pending
        </Badge>
      </div>

      {pendingMinutes?.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Minutes Pending Review</h3>
            <p className="text-muted-foreground">
              All submitted minutes have been reviewed. New submissions will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pendingMinutes?.map((minute) => (
            <Card key={minute.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{minute.title}</h3>
                      {getStatusBadge(minute.status)}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground mb-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(minute.meeting_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>By: {minute.creator_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>Submitted: {new Date(minute.submitted_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="text-sm">
                      <p className="text-muted-foreground mb-1">Meeting Type:</p>
                      <p className="capitalize">{minute.meeting_type}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openViewDialog(minute)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Review
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Meeting Minutes</DialogTitle>
          </DialogHeader>
          
          {selectedMinute && (
            <div className="space-y-6">
              {/* Minutes Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <Label className="text-sm font-medium">Title</Label>
                  <p className="text-sm">{selectedMinute.title}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Meeting Date</Label>
                  <p className="text-sm">{new Date(selectedMinute.meeting_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Meeting Type</Label>
                  <p className="text-sm capitalize">{selectedMinute.meeting_type}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Created By</Label>
                  <p className="text-sm">{selectedMinute.creator_name}</p>
                </div>
              </div>

              {/* Minutes Content */}
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Agenda</Label>
                  <div className="mt-1 p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                    {selectedMinute.agenda || "No agenda provided"}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Discussions</Label>
                  <div className="mt-1 p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                    {selectedMinute.discussions || "No discussions recorded"}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Decisions</Label>
                  <div className="mt-1 p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                    {selectedMinute.decisions || "No decisions recorded"}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Action Items</Label>
                  <div className="mt-1 p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                    {selectedMinute.action_items || "No action items"}
                  </div>
                </div>

                {selectedMinute.attendees?.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Attendees</Label>
                    <div className="mt-1 p-3 bg-muted rounded-lg text-sm">
                      {selectedMinute.attendees.join(", ")}
                    </div>
                  </div>
                )}
              </div>

              {/* Review Notes */}
              <div>
                <Label htmlFor="review-notes">Review Notes</Label>
                <Textarea
                  id="review-notes"
                  placeholder="Add your review notes (required for rejection, optional for approval)..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="mt-1"
                  rows={4}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setViewDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={rejectMutation.isPending || !reviewNotes.trim()}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  {rejectMutation.isPending ? "Rejecting..." : "Reject"}
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={approveMutation.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {approveMutation.isPending ? "Approving..." : "Approve & Forward"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}