import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
const supabase: any = supabaseClient;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Eye, CheckCircle, XCircle, Clock, FileText, User, Calendar, Edit, Loader2 } from "lucide-react";
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
  secretary_name?: string;
  secretary_signature_url?: string;
  chairperson_name?: string;
  chairperson_signature_url?: string;
}

export default function MinutesReview() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedMinute, setSelectedMinute] = useState<MinuteDetails | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedMinute, setEditedMinute] = useState<MinuteDetails | null>(null);

  const { data: meetingMinutes = [], isLoading } = useQuery({
    queryKey: ["meeting-minutes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_minutes")
        .select(`
          *,
          creator:created_by (
            email
          )
        `)
        .order("meeting_date", { ascending: false });

      if (error) throw error;

      return data?.map(minute => ({
        ...minute,
        creator_name: minute.creator?.email || "Unknown"
      })) || [];
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });

  const pendingMinutes = meetingMinutes.filter((minute) => minute.status === "submitted_to_secretary");

  // Approve and forward to chairperson — auto-prefill secretary & chairperson signature & name
  const approveMutation = useMutation({
    mutationFn: async ({ minuteId, notes }: { minuteId: string; notes: string }) => {
      // Look up the secretary's stored signature
      const { data: secretarySigRow } = await supabase
        .from("office_bearer_signatures")
        .select("signature_url")
        .eq("role", "secretary")
        .maybeSingle();

      // Look up the chairperson's stored signature
      const { data: chairpersonSigRow } = await supabase
        .from("office_bearer_signatures")
        .select("signature_url")
        .eq("role", "chairperson")
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

      // Look up the chairperson's display name from members (using chairperson role)
      let chairpersonName: string | null = null;
      const { data: chairpersonRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "chairperson")
        .limit(1);
      
      if (chairpersonRoles?.[0]?.user_id) {
        const { data: chairpersonMember } = await supabase
          .from("members")
          .select("name")
          .eq("user_id", chairpersonRoles[0].user_id)
          .maybeSingle();
        chairpersonName = chairpersonMember?.name || null;
      }

      const updatePayload: any = {
        status: "secretary_reviewed",
        secretary_reviewed_by: user?.id,
        secretary_reviewed_at: new Date().toISOString(),
        secretary_notes: notes,
        updated_at: new Date().toISOString(),
      };
      if (secretarySigRow?.signature_url) updatePayload.secretary_signature_url = secretarySigRow.signature_url;
      if (secretaryName) updatePayload.secretary_name = secretaryName;
      if (chairpersonSigRow?.signature_url) updatePayload.chairperson_signature_url = chairpersonSigRow.signature_url;
      if (chairpersonName) updatePayload.chairperson_name = chairpersonName;

      const { error } = await supabase
        .from("meeting_minutes")
        .update(updatePayload)
        .eq("id", minuteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-minutes"] });
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
      queryClient.invalidateQueries({ queryKey: ["meeting-minutes"] });
      toast.success("Minutes rejected and sent back to Vice Secretary");
      setSelectedMinute(null);
      setReviewNotes("");
      setViewDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Failed to reject minutes: " + error.message);
    },
  });

  // Update minutes with secretary and chairperson info auto-filled
  const updateMutation = useMutation({
    mutationFn: async (minute: MinuteDetails) => {
      // Look up the secretary's stored signature
      const { data: secretarySigRow } = await supabase
        .from("office_bearer_signatures")
        .select("signature_url")
        .eq("role", "secretary")
        .maybeSingle();

      // Look up the chairperson's stored signature
      const { data: chairpersonSigRow } = await supabase
        .from("office_bearer_signatures")
        .select("signature_url")
        .eq("role", "chairperson")
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

      // Look up the chairperson's display name from members (using chairperson role)
      let chairpersonName: string | null = null;
      const { data: chairpersonRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "chairperson")
        .limit(1);
      
      if (chairpersonRoles?.[0]?.user_id) {
        const { data: chairpersonMember } = await supabase
          .from("members")
          .select("name")
          .eq("user_id", chairpersonRoles[0].user_id)
          .maybeSingle();
        chairpersonName = chairpersonMember?.name || null;
      }

      const updatePayload: any = {
        title: minute.title,
        meeting_date: minute.meeting_date,
        meeting_type: minute.meeting_type,
        agenda: minute.agenda,
        discussions: minute.discussions,
        decisions: minute.decisions,
        action_items: minute.action_items,
        updated_at: new Date().toISOString(),
      };

      // Auto-fill secretary info
      if (secretarySigRow?.signature_url) updatePayload.secretary_signature_url = secretarySigRow.signature_url;
      if (secretaryName) updatePayload.secretary_name = secretaryName;
      
      // Auto-fill chairperson info
      if (chairpersonSigRow?.signature_url) updatePayload.chairperson_signature_url = chairpersonSigRow.signature_url;
      if (chairpersonName) updatePayload.chairperson_name = chairpersonName;

      const { error } = await supabase
        .from("meeting_minutes")
        .update(updatePayload)
        .eq("id", minute.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-minutes"] });
      toast.success("Minutes updated with secretary and chairperson information");
      setEditMode(false);
      setEditedMinute(null);
      setSelectedMinute(null);
      setViewDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Failed to update minutes: " + error.message);
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

  const handleEdit = () => {
    if (selectedMinute) {
      setEditedMinute({ ...selectedMinute });
      setEditMode(true);
    }
  };

  const handleSaveEdit = () => {
    if (!editedMinute) return;
    updateMutation.mutate(editedMinute);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditedMinute(null);
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
          {pendingMinutes.length} Pending
        </Badge>
      </div>

      {meetingMinutes.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No meeting minutes recorded yet</h3>
            <p className="text-muted-foreground">
              Meeting minutes will appear here once they are created or submitted.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {meetingMinutes.map((minute) => (
            <Card key={minute.id} className="border rounded-lg p-4 hover:bg-accent/50 transition">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{minute.title}</h3>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {new Date(minute.meeting_date).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(minute.status)}
                  <Badge variant="outline">{minute.meeting_type}</Badge>
                </div>
              </div>

              {minute.attendees && minute.attendees.length > 0 && (
                <div className="text-sm mb-2">
                  <span className="font-medium">Attendees:</span> {minute.attendees.join(", ")}
                </div>
              )}

              {minute.agenda && (
                <div className="text-sm mb-2">
                  <span className="font-medium">Agenda:</span> {minute.agenda.substring(0, 100)}...
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openViewDialog(minute)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  {minute.status === "submitted_to_secretary" ? "Review" : "View"}
                </Button>
                {minute.status === "submitted_to_secretary" && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => openViewDialog(minute)}
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    Review Pending
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setViewDialogOpen(false);
          setEditMode(false);
          setEditedMinute(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editMode ? "Edit Meeting Minutes" : "Review Meeting Minutes"}</DialogTitle>
          </DialogHeader>
          
          {editMode && editedMinute ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Title</Label>
                  <Input
                    value={editedMinute.title}
                    onChange={(e) => setEditedMinute({ ...editedMinute, title: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Meeting Date</Label>
                  <Input
                    type="date"
                    value={editedMinute.meeting_date}
                    onChange={(e) => setEditedMinute({ ...editedMinute, meeting_date: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Agenda</Label>
                <Textarea
                  value={editedMinute.agenda || ""}
                  onChange={(e) => setEditedMinute({ ...editedMinute, agenda: e.target.value })}
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Discussions</Label>
                <Textarea
                  value={editedMinute.discussions || ""}
                  onChange={(e) => setEditedMinute({ ...editedMinute, discussions: e.target.value })}
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Decisions</Label>
                <Textarea
                  value={editedMinute.decisions || ""}
                  onChange={(e) => setEditedMinute({ ...editedMinute, decisions: e.target.value })}
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Action Items</Label>
                <Textarea
                  value={editedMinute.action_items || ""}
                  onChange={(e) => setEditedMinute({ ...editedMinute, action_items: e.target.value })}
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  ℹ️ When you save, your secretary name, signature, and the chairperson's information will be automatically pre-filled for approval.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={updateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Save & Pre-fill Info
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : selectedMinute ? (
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
                  variant="outline"
                  onClick={handleEdit}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Minutes
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
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}