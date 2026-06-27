import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Plus, Edit, Send, FileText, Clock, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { MinutesForm } from "@/components/minutes/MinutesForm";

export default function MinutesManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedMinute, setSelectedMinute] = useState<any | null>(null);

  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [absenceSearch, setAbsenceSearch] = useState("");
  const [absenceWithApologySearch, setAbsenceWithApologySearch] = useState("");
  const [visibilitySearch, setVisibilitySearch] = useState("");

  const emptyForm = {
    title: "",
    meeting_date: new Date().toISOString().split("T")[0],
    meeting_type: "general",
    agenda: "",
    discussions: "",
    decisions: "",
    action_items: "",
    next_meeting_date: "",
    absent_with_apology: [] as string[],
    absent_without_apology: [] as string[],
    visible_to_members: [] as string[],
  };
  const [form, setForm] = useState<any>(emptyForm);

  const { data: minutes, isLoading } = useQuery({
    queryKey: ["vice-secretary-minutes", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_minutes")
        .select("*")
        .eq("created_by", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members-for-attendance"],
    queryFn: async () => {
      const { data } = await supabase
        .from("members")
        .select("id, name, phone")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  const { data: executiveMembers = [] } = useQuery({
    queryKey: ["executive-members"],
    queryFn: async () => {
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["chairperson", "vice_chairperson", "secretary", "vice_secretary", "patron", "treasurer", "admin", "super_admin", "executive"]);
      if (!rolesData?.length) return [];
      const userIds = rolesData.map(r => r.user_id);
      const { data: membersData } = await supabase
        .from("members")
        .select("id, user_id, name, phone")
        .in("user_id", userIds);
      const memberMap = new Map(membersData?.map(m => [m.user_id, m]) || []);
      const seen = new Set<string>();
      return rolesData
        .filter(r => { if (seen.has(r.user_id)) return false; seen.add(r.user_id); return true; })
        .map(r => ({ 
          user_id: r.user_id, 
          role: r.role, 
          members: memberMap?.get(r.user_id) || { name: "Unknown", phone: "" } 
        }))
        .filter(r => r.members?.name && r.members.name !== "Unknown");
    },
  });

  const buildPayload = () => ({
    title: form.title,
    meeting_date: form.meeting_date,
    meeting_type: form.meeting_type,
    attendees: selectedAttendees,
    agenda: form.agenda || null,
    discussions: form.discussions || null,
    decisions: form.decisions || null,
    action_items: form.action_items || null,
    next_meeting_date: form.next_meeting_date || null,
    absent_with_apology: form.absent_with_apology,
    absent_without_apology: form.absent_without_apology,
    visible_to_members: form.visible_to_members,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("meeting_minutes").insert({
        ...buildPayload(),
        created_by: user?.id,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vice-secretary-minutes"] });
      toast.success("Minutes created");
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("meeting_minutes")
        .update({ ...buildPayload(), updated_at: new Date().toISOString() })
        .eq("id", selectedMinute.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vice-secretary-minutes"] });
      toast.success("Minutes updated");
      setEditDialogOpen(false);
      setSelectedMinute(null);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const submitMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("meeting_minutes")
        .update({
          status: "submitted_to_secretary",
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vice-secretary-minutes"] });
      queryClient.invalidateQueries({ queryKey: ["secretary-pending-minutes"] });
      toast.success("Submitted to Secretary for review");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setForm(emptyForm);
    setSelectedAttendees([]);
    setAttendeeSearch("");
    setAbsenceSearch("");
    setAbsenceWithApologySearch("");
    setVisibilitySearch("");
  };

  const openEdit = (m: any) => {
    setSelectedMinute(m);
    setForm({
      title: m.title,
      meeting_date: m.meeting_date,
      meeting_type: m.meeting_type,
      agenda: m.agenda || "",
      discussions: m.discussions || "",
      decisions: m.decisions || "",
      action_items: m.action_items || "",
      next_meeting_date: m.next_meeting_date || "",
      absent_with_apology: m.absent_with_apology || [],
      absent_without_apology: m.absent_without_apology || [],
      visible_to_members: m.visible_to_members || [],
    });
    setSelectedAttendees(m.attendees || []);
    setEditDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft": return <Badge variant="secondary"><Edit className="h-3 w-3 mr-1" />Draft</Badge>;
      case "submitted_to_secretary": return <Badge variant="outline" className="text-orange-600 border-orange-600"><Clock className="h-3 w-3 mr-1" />Under Review</Badge>;
      case "secretary_reviewed":
      case "submitted": return <Badge variant="outline" className="text-blue-600 border-blue-600"><CheckCircle className="h-3 w-3 mr-1" />Forwarded</Badge>;
      case "rejected_by_secretary": return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected by Secretary</Badge>;
      case "rejected":
      case "rejected_by_chairperson": return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Rejected by Chairperson</Badge>;
      case "approved": return <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const canEdit = (s: string) => ["draft", "rejected_by_secretary", "rejected_by_chairperson", "rejected"].includes(s);
  const canSubmit = (s: string) => s === "draft";

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><FileText className="h-8 w-8" />Meeting Minutes</h1>
          <p className="text-muted-foreground mt-1">Draft minutes and submit to Secretary for proofreading</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={(o) => { setCreateDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}><Plus className="h-4 w-4 mr-2" />New Minutes</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Meeting Minutes</DialogTitle>
              <DialogDescription>Record the details — Secretary will proofread before chairperson approval</DialogDescription>
            </DialogHeader>
            <MinutesForm
              form={form}
              setForm={setForm}
              selectedAttendees={selectedAttendees}
              setSelectedAttendees={setSelectedAttendees}
              attendeeSearch={attendeeSearch}
              setAttendeeSearch={setAttendeeSearch}
              members={members}
              executiveMembers={executiveMembers}
              absenceSearch={absenceSearch}
              setAbsenceSearch={setAbsenceSearch}
              absenceWithApologySearch={absenceWithApologySearch}
              setAbsenceWithApologySearch={setAbsenceWithApologySearch}
              visibilitySearch={visibilitySearch}
              setVisibilitySearch={setVisibilitySearch}
              hideStatus
            />
            <Button
              className="w-full"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.title || !form.meeting_date}
            >
              {createMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : "Create Minutes"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {minutes?.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Minutes Created</h3>
            <p className="text-muted-foreground mb-4">Start by creating your first meeting minutes.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {minutes?.map((m: any) => (
            <Card key={m.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="text-lg font-semibold">{m.title}</h3>
                      {getStatusBadge(m.status)}
                      <Badge variant="outline">{m.meeting_type}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Meeting Date: {new Date(m.meeting_date).toLocaleDateString()}
                    </div>
                    {(m.secretary_notes || m.rejection_notes) && (
                      <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">Feedback:</p>
                        <p className="text-sm text-red-700 dark:text-red-400">{m.secretary_notes || m.rejection_notes}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {canEdit(m.status) && (
                      <Button variant="outline" size="sm" onClick={() => openEdit(m)}>
                        <Edit className="h-4 w-4 mr-2" />Edit
                      </Button>
                    )}
                    {canSubmit(m.status) && (
                      <Button size="sm" onClick={() => submitMutation.mutate(m.id)} disabled={submitMutation.isPending}>
                        <Send className="h-4 w-4 mr-2" />Submit
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editDialogOpen} onOpenChange={(o) => { setEditDialogOpen(o); if (!o) { setSelectedMinute(null); resetForm(); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Meeting Minutes</DialogTitle>
            <DialogDescription>Update the meeting details</DialogDescription>
          </DialogHeader>
          <MinutesForm
            form={form}
            setForm={setForm}
            selectedAttendees={selectedAttendees}
            setSelectedAttendees={setSelectedAttendees}
            attendeeSearch={attendeeSearch}
            setAttendeeSearch={setAttendeeSearch}
            members={members}
            executiveMembers={executiveMembers}
            absenceSearch={absenceSearch}
            setAbsenceSearch={setAbsenceSearch}
            absenceWithApologySearch={absenceWithApologySearch}
            setAbsenceWithApologySearch={setAbsenceWithApologySearch}
            visibilitySearch={visibilitySearch}
            setVisibilitySearch={setVisibilitySearch}
            hideStatus
          />
          <Button
            className="w-full"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || !form.title || !form.meeting_date}
          >
            {updateMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Updating...</> : "Update Minutes"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
