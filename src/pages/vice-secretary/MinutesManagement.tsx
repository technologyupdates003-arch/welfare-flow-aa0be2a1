import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Send, Eye, FileText, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

interface MinuteForm {
  title: string;
  meeting_date: string;
  meeting_type: string;
  agenda: string;
  discussions: string;
  decisions: string;
  action_items: string;
  next_meeting_date: string;
  attendees: string[];
}

interface MinuteDetails extends MinuteForm {
  id: string;
  status: string;
  created_at: string;
  submitted_at?: string;
  secretary_notes?: string;
  rejection_notes?: string;
}

export default function MinutesManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedMinute, setSelectedMinute] = useState<MinuteDetails | null>(null);
  const [attendeeInput, setAttendeeInput] = useState("");
  
  const [form, setForm] = useState<MinuteForm>({
    title: "",
    meeting_date: "",
    meeting_type: "general",
    agenda: "",
    discussions: "",
    decisions: "",
    action_items: "",
    next_meeting_date: "",
    attendees: [],
  });

  // Fetch minutes created by vice secretary
  const { data: minutes, isLoading } = useQuery({
    queryKey: ["vice-secretary-minutes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_minutes")
        .select("*")
        .eq("created_by", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Create new minutes
  const createMutation = useMutation({
    mutationFn: async (minuteData: MinuteForm) => {
      const { error } = await supabase
        .from("meeting_minutes")
        .insert({
          ...minuteData,
          created_by: user?.id,
          status: "draft",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vice-secretary-minutes"] });
      toast.success("Minutes created successfully");
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Failed to create minutes: " + error.message);
    },
  });

  // Update minutes
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MinuteForm> }) => {
      const { error } = await supabase
        .from("meeting_minutes")
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vice-secretary-minutes"] });
      toast.success("Minutes updated successfully");
      setEditDialogOpen(false);
      setSelectedMinute(null);
    },
    onError: (error) => {
      toast.error("Failed to update minutes: " + error.message);
    },
  });

  // Submit to secretary
  const submitMutation = useMutation({
    mutationFn: async (minuteId: string) => {
      const { error } = await supabase
        .from("meeting_minutes")
        .update({
          status: "submitted_to_secretary",
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", minuteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vice-secretary-minutes"] });
      toast.success("Minutes submitted to Secretary for review");
    },
    onError: (error) => {
      toast.error("Failed to submit minutes: " + error.message);
    },
  });

  const resetForm = () => {
    setForm({
      title: "",
      meeting_date: "",
      meeting_type: "general",
      agenda: "",
      discussions: "",
      decisions: "",
      action_items: "",
      next_meeting_date: "",
      attendees: [],
    });
    setAttendeeInput("");
  };

  const handleCreate = () => {
    if (!form.title || !form.meeting_date) {
      toast.error("Please fill in required fields");
      return;
    }
    createMutation.mutate(form);
  };

  const handleUpdate = () => {
    if (!selectedMinute) return;
    updateMutation.mutate({ id: selectedMinute.id, data: form });
  };

  const handleSubmit = (minuteId: string) => {
    submitMutation.mutate(minuteId);
  };

  const openEditDialog = (minute: MinuteDetails) => {
    setSelectedMinute(minute);
    setForm({
      title: minute.title,
      meeting_date: minute.meeting_date,
      meeting_type: minute.meeting_type,
      agenda: minute.agenda || "",
      discussions: minute.discussions || "",
      decisions: minute.decisions || "",
      action_items: minute.action_items || "",
      next_meeting_date: minute.next_meeting_date || "",
      attendees: minute.attendees || [],
    });
    setEditDialogOpen(true);
  };

  const addAttendee = () => {
    if (attendeeInput.trim() && !form.attendees.includes(attendeeInput.trim())) {
      setForm({ ...form, attendees: [...form.attendees, attendeeInput.trim()] });
      setAttendeeInput("");
    }
  };

  const removeAttendee = (attendee: string) => {
    setForm({ ...form, attendees: form.attendees.filter(a => a !== attendee) });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary"><Edit className="h-3 w-3 mr-1" />Draft</Badge>;
      case "submitted_to_secretary":
        return <Badge variant="outline" className="text-orange-600 border-orange-600"><Clock className="h-3 w-3 mr-1" />Under Review</Badge>;
      case "secretary_reviewed":
        return <Badge variant="outline" className="text-blue-600 border-blue-600"><CheckCircle className="h-3 w-3 mr-1" />Forwarded</Badge>;
      case "rejected_by_secretary":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected by Secretary</Badge>;
      case "rejected_by_chairperson":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Rejected by Chairperson</Badge>;
      case "approved":
        return <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const canEdit = (status: string) => {
    return ["draft", "rejected_by_secretary", "rejected_by_chairperson"].includes(status);
  };

  const canSubmit = (status: string) => {
    return status === "draft";
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
          <h1 className="text-3xl font-bold">Meeting Minutes</h1>
          <p className="text-muted-foreground mt-1">Create and manage meeting minutes</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              New Minutes
            </Button>
          </DialogTrigger>
        </Dialog>
      </div>

      {minutes?.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Minutes Created</h3>
            <p className="text-muted-foreground mb-4">
              Start by creating your first meeting minutes.
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Minutes
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {minutes?.map((minute) => (
            <Card key={minute.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{minute.title}</h3>
                      {getStatusBadge(minute.status)}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground mb-4">
                      <div>
                        <span className="font-medium">Meeting Date:</span> {new Date(minute.meeting_date).toLocaleDateString()}
                      </div>
                      <div>
                        <span className="font-medium">Type:</span> <span className="capitalize">{minute.meeting_type}</span>
                      </div>
                      <div>
                        <span className="font-medium">Created:</span> {new Date(minute.created_at).toLocaleDateString()}
                      </div>
                      {minute.submitted_at && (
                        <div>
                          <span className="font-medium">Submitted:</span> {new Date(minute.submitted_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    {/* Show rejection notes if any */}
                    {((minute as any).secretary_notes || minute.rejection_notes) && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm font-medium text-red-800 mb-1">Feedback:</p>
                        <p className="text-sm text-red-700">
                          {(minute as any).secretary_notes || minute.rejection_notes}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4">
                    {canEdit(minute.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(minute)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    )}
                    {canSubmit(minute.status) && (
                      <Button
                        size="sm"
                        onClick={() => handleSubmit(minute.id)}
                        disabled={submitMutation.isPending}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Submit
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={createDialogOpen || editDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open && createDialogOpen);
        setEditDialogOpen(open && editDialogOpen);
        if (!open) {
          resetForm();
          setSelectedMinute(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {createDialogOpen ? "Create New Minutes" : "Edit Minutes"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Meeting title"
                />
              </div>
              <div>
                <Label htmlFor="meeting_date">Meeting Date *</Label>
                <Input
                  id="meeting_date"
                  type="date"
                  value={form.meeting_date}
                  onChange={(e) => setForm({ ...form, meeting_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="meeting_type">Meeting Type</Label>
                <Select value={form.meeting_type} onValueChange={(value) => setForm({ ...form, meeting_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Meeting</SelectItem>
                    <SelectItem value="executive">Executive Meeting</SelectItem>
                    <SelectItem value="emergency">Emergency Meeting</SelectItem>
                    <SelectItem value="annual">Annual Meeting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="next_meeting_date">Next Meeting Date</Label>
                <Input
                  id="next_meeting_date"
                  type="date"
                  value={form.next_meeting_date}
                  onChange={(e) => setForm({ ...form, next_meeting_date: e.target.value })}
                />
              </div>
            </div>

            {/* Attendees */}
            <div>
              <Label>Attendees</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={attendeeInput}
                  onChange={(e) => setAttendeeInput(e.target.value)}
                  placeholder="Add attendee name"
                  onKeyPress={(e) => e.key === "Enter" && addAttendee()}
                />
                <Button type="button" onClick={addAttendee} variant="outline">
                  Add
                </Button>
              </div>
              {form.attendees.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.attendees.map((attendee, index) => (
                    <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeAttendee(attendee)}>
                      {attendee} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="agenda">Agenda</Label>
              <Textarea
                id="agenda"
                value={form.agenda}
                onChange={(e) => setForm({ ...form, agenda: e.target.value })}
                placeholder="Meeting agenda..."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="discussions">Discussions</Label>
              <Textarea
                id="discussions"
                value={form.discussions}
                onChange={(e) => setForm({ ...form, discussions: e.target.value })}
                placeholder="Key discussions and points raised..."
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="decisions">Decisions</Label>
              <Textarea
                id="decisions"
                value={form.decisions}
                onChange={(e) => setForm({ ...form, decisions: e.target.value })}
                placeholder="Decisions made during the meeting..."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="action_items">Action Items</Label>
              <Textarea
                id="action_items"
                value={form.action_items}
                onChange={(e) => setForm({ ...form, action_items: e.target.value })}
                placeholder="Action items and follow-ups..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateDialogOpen(false);
                  setEditDialogOpen(false);
                  resetForm();
                  setSelectedMinute(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={createDialogOpen ? handleCreate : handleUpdate}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createDialogOpen ? "Create Minutes" : "Update Minutes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}