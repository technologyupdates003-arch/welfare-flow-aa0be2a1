import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calendar, FileText, Users, Edit, Trash2, Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { initiateB2CWithdrawal } from "@/lib/b2c";

export default function SecretaryDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [eventOpen, setEventOpen] = useState(false);
  const [editEventOpen, setEditEventOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    event_type: "",
    contribution_amount: "",
    departed_name: "",
    relationship: "",
    related_member_id: "",
  });

  // Fetch pending withdrawal approvals for secretary
  useEffect(() => {
    const fetchWithdrawals = async () => {
      if (!user) return;

      try {
        const { data: withdrawalsData, error: withdrawalsError } = await supabase
          .from('penalty_withdrawals')
          .select(`
            id,
            amount,
            reason,
            status,
            requested_by,
            submitted_at,
            created_at,
            phone_number,
            withdrawal_signatories (
              id,
              signatory_role,
              status,
              signature_url,
              approved_at,
              rejected_at,
              signatory_user_id
            )
          `)
          .eq('withdrawal_signatories.signatory_role', 'secretary')
          .eq('withdrawal_signatories.status', 'pending')
          .or(`withdrawal_signatories.signatory_user_id.eq.${user.id},withdrawal_signatories.signatory_user_id.is.null`)
          .order('created_at', { ascending: false });

        if (withdrawalsError) throw withdrawalsError;

        setWithdrawals(withdrawalsData || []);
      } catch (error) {
        console.error('Error fetching withdrawals:', error);
      }
    };

    fetchWithdrawals();
  }, [user]);

  const getPendingWithdrawals = () => {
    return withdrawals.filter((w) => {
      const secretarySignatory = w.withdrawal_signatories?.find(
        (s: any) => s.signatory_role === 'secretary' && s.status === 'pending'
      );
      return !!secretarySignatory;
    });
  };

  const handleApproval = async (action: 'approve' | 'reject') => {
    if (!selectedWithdrawal || !user) return;

    if (action === 'reject' && !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setProcessing(true);

      const { error: updateError } = await supabase
        .from('withdrawal_signatories')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          [action === 'approve' ? 'approved_at' : 'rejected_at']: new Date().toISOString(),
          rejection_reason: action === 'reject' ? rejectionReason : null,
        })
        .eq('withdrawal_id', selectedWithdrawal.id)
        .eq('signatory_role', 'secretary');

      if (updateError) throw updateError;

      const { data: allSignatories } = await supabase
        .from('withdrawal_signatories')
        .select('status')
        .eq('withdrawal_id', selectedWithdrawal.id);

      const allApproved = allSignatories?.every((s) => s.status === 'approved');
      const anyRejected = allSignatories?.some((s) => s.status === 'rejected');

      if (allApproved) {
        toast.loading('Processing B2C transfer...');

        const b2cResult = await initiateB2CWithdrawal({
          withdrawalId: selectedWithdrawal.id,
          amount: selectedWithdrawal.amount,
          phoneNumber: selectedWithdrawal.phone_number || '',
          reason: selectedWithdrawal.reason,
          adminName: user.email || 'Admin',
        });

        if (b2cResult.success) {
          await supabase
            .from('penalty_withdrawals')
            .update({
              status: 'completed',
              submitted_at: new Date().toISOString(),
            })
            .eq('id', selectedWithdrawal.id);

          toast.success(
            `✅ Withdrawal completed! KES ${selectedWithdrawal.amount.toLocaleString()} transferred`
          );
        } else {
          await supabase
            .from('penalty_withdrawals')
            .update({
              status: 'approved',
              submitted_at: new Date().toISOString(),
            })
            .eq('id', selectedWithdrawal.id);

          toast.error(`Approval complete but transfer failed: ${b2cResult.error}`);
        }
      } else if (anyRejected) {
        await supabase
          .from('penalty_withdrawals')
          .update({
            status: 'rejected',
          })
          .eq('id', selectedWithdrawal.id);

        toast.error('Withdrawal rejected');
      } else {
        toast.success(`Withdrawal ${action === 'approve' ? 'approved' : 'rejected'}`);
      }

      setShowApprovalDialog(false);
      setSelectedWithdrawal(null);
      setRejectionReason('');

      // Refresh
      const { data: updatedWithdrawals, error: updatedError } = await supabase
        .from('penalty_withdrawals')
        .select(`
          id,
          amount,
          reason,
          status,
          requested_by,
          submitted_at,
          created_at,
          phone_number,
          withdrawal_signatories (
            id,
            signatory_role,
            status,
            signature_url,
            approved_at,
            rejected_at,
            signatory_user_id
          )
        `)
        .eq('withdrawal_signatories.signatory_role', 'secretary')
        .eq('withdrawal_signatories.status', 'pending')
        .or(`withdrawal_signatories.signatory_user_id.eq.${user.id},withdrawal_signatories.signatory_user_id.is.null`)
        .order('created_at', { ascending: false });

      if (updatedError) throw updatedError;
      setWithdrawals(updatedWithdrawals || []);
    } catch (error) {
      console.error('Error processing approval:', error);
      toast.error('Failed to process approval');
    } finally {
      setProcessing(false);
    }
  };

  const { data: events, isLoading } = useQuery({
    queryKey: ["secretary-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select(`
          *,
          members:related_member_id (name)
        `)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: members } = useQuery({
    queryKey: ["members-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("members")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["secretary-stats"],
    queryFn: async () => {
      const [eventsRes, membersRes, documentsRes] = await Promise.all([
        supabase.from("events").select("id, status"),
        supabase.from("members").select("id").eq("is_active", true),
        supabase.from("documents").select("id"),
      ]);

      return {
        totalEvents: eventsRes.data?.length || 0,
        activeEvents: eventsRes.data?.filter(e => e.status === "active").length || 0,
        totalMembers: membersRes.data?.length || 0,
        totalDocuments: documentsRes.data?.length || 0,
      };
    },
  });

  const createEvent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("events").insert({
        title: eventForm.title,
        description: eventForm.description || null,
        event_type: eventForm.event_type,
        contribution_amount: Number(eventForm.contribution_amount) || 0,
        departed_name: eventForm.departed_name || null,
        relationship: eventForm.relationship || null,
        related_member_id: eventForm.related_member_id || null,
        created_by: user?.id || "",
        status: "active",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["secretary-events"] });
      queryClient.invalidateQueries({ queryKey: ["secretary-stats"] });
      setEventOpen(false);
      setEventForm({
        title: "",
        description: "",
        event_type: "",
        contribution_amount: "",
        departed_name: "",
        relationship: "",
        related_member_id: "",
      });
      toast.success("Event created successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateEvent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("events")
        .update({
          title: eventForm.title,
          description: eventForm.description || null,
          event_type: eventForm.event_type,
          contribution_amount: Number(eventForm.contribution_amount) || 0,
          departed_name: eventForm.departed_name || null,
          relationship: eventForm.relationship || null,
          related_member_id: eventForm.related_member_id || null,
        })
        .eq("id", selectedEvent.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["secretary-events"] });
      setEditEventOpen(false);
      setSelectedEvent(null);
      toast.success("Event updated successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteEvent = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.from("events").delete().eq("id", eventId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["secretary-events"] });
      queryClient.invalidateQueries({ queryKey: ["secretary-stats"] });
      toast.success("Event deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleEditEvent = (event: any) => {
    setSelectedEvent(event);
    setEventForm({
      title: event.title,
      description: event.description || "",
      event_type: event.event_type,
      contribution_amount: event.contribution_amount.toString(),
      departed_name: event.departed_name || "",
      relationship: event.relationship || "",
      related_member_id: event.related_member_id || "",
    });
    setEditEventOpen(true);
  };

  const openMinuteTemplate = () => {
    window.open("/secretary/minutes", "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Secretary Dashboard</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openMinuteTemplate}>
            <FileText className="h-4 w-4 mr-2" />
            Meeting Minutes
          </Button>
          <Badge variant="default" className="text-sm self-center">Event Management</Badge>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalEvents || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Events</CardTitle>
            <Calendar className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.activeEvents || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalMembers || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalDocuments || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Events Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Events Management</CardTitle>
          <Dialog open={eventOpen} onOpenChange={setEventOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Event
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Event</DialogTitle>
                <DialogDescription>Create a new welfare event</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Event Title</Label>
                  <Input
                    value={eventForm.title}
                    onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Event title"
                  />
                </div>
                <div>
                  <Label>Event Type</Label>
                  <Select
                    value={eventForm.event_type}
                    onValueChange={value => setEventForm(f => ({ ...f, event_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bereavement">Bereavement</SelectItem>
                      <SelectItem value="medical">Medical Emergency</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="social">Social Event</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Contribution Amount (KES)</Label>
                  <Input
                    type="number"
                    value={eventForm.contribution_amount}
                    onChange={e => setEventForm(f => ({ ...f, contribution_amount: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                {eventForm.event_type === "bereavement" && (
                  <>
                    <div>
                      <Label>Departed Name</Label>
                      <Input
                        value={eventForm.departed_name}
                        onChange={e => setEventForm(f => ({ ...f, departed_name: e.target.value }))}
                        placeholder="Name of the departed"
                      />
                    </div>
                    <div>
                      <Label>Relationship</Label>
                      <Select
                        value={eventForm.relationship}
                        onValueChange={value => setEventForm(f => ({ ...f, relationship: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select relationship" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="spouse">Spouse</SelectItem>
                          <SelectItem value="child">Child</SelectItem>
                          <SelectItem value="parent">Parent</SelectItem>
                          <SelectItem value="sibling">Sibling</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                <div>
                  <Label>Related Member (Optional)</Label>
                  <Select
                    value={eventForm.related_member_id}
                    onValueChange={value => setEventForm(f => ({ ...f, related_member_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members?.map(member => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Description</Label>
                  <Textarea
                    value={eventForm.description}
                    onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Event description..."
                    rows={3}
                  />
                </div>
              </div>
              <Button
                onClick={() => createEvent.mutate()}
                disabled={createEvent.isPending || !eventForm.title || !eventForm.event_type}
                className="w-full"
              >
                {createEvent.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
                ) : (
                  "Create Event"
                )}
              </Button>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Loading events...</div>
          ) : events?.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">No events created yet</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contribution</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events?.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">{event.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {event.event_type.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>KES {event.contribution_amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={event.status === "active" ? "default" : "secondary"}>
                        {event.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(event.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditEvent(event)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm(`Delete event "${event.title}"?`)) {
                              deleteEvent.mutate(event.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Event Dialog */}
      <Dialog open={editEventOpen} onOpenChange={setEditEventOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>Update event information</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Event Title</Label>
              <Input
                value={eventForm.title}
                onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Event title"
              />
            </div>
            <div>
              <Label>Event Type</Label>
              <Select
                value={eventForm.event_type}
                onValueChange={value => setEventForm(f => ({ ...f, event_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bereavement">Bereavement</SelectItem>
                  <SelectItem value="medical">Medical Emergency</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="social">Social Event</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contribution Amount (KES)</Label>
              <Input
                type="number"
                value={eventForm.contribution_amount}
                onChange={e => setEventForm(f => ({ ...f, contribution_amount: e.target.value }))}
                placeholder="0"
              />
            </div>
            {eventForm.event_type === "bereavement" && (
              <>
                <div>
                  <Label>Departed Name</Label>
                  <Input
                    value={eventForm.departed_name}
                    onChange={e => setEventForm(f => ({ ...f, departed_name: e.target.value }))}
                    placeholder="Name of the departed"
                  />
                </div>
                <div>
                  <Label>Relationship</Label>
                  <Select
                    value={eventForm.relationship}
                    onValueChange={value => setEventForm(f => ({ ...f, relationship: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spouse">Spouse</SelectItem>
                      <SelectItem value="child">Child</SelectItem>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="sibling">Sibling</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div>
              <Label>Related Member (Optional)</Label>
              <Select
                value={eventForm.related_member_id}
                onValueChange={value => setEventForm(f => ({ ...f, related_member_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent>
                  {members?.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea
                value={eventForm.description}
                onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Event description..."
                rows={3}
              />
            </div>
          </div>
          <Button
            onClick={() => updateEvent.mutate()}
            disabled={updateEvent.isPending || !eventForm.title || !eventForm.event_type}
            className="w-full"
          >
            {updateEvent.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating...</>
            ) : (
              "Update Event"
            )}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Withdrawal Approvals Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Withdrawal Approvals
          </CardTitle>
          <Badge className="bg-blue-100 text-blue-800">
            {getPendingWithdrawals().length} Pending
          </Badge>
        </CardHeader>
        <CardContent>
          {getPendingWithdrawals().length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No pending withdrawals</p>
          ) : (
            <div className="space-y-4">
              {getPendingWithdrawals().map((withdrawal) => (
                <div key={withdrawal.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">KES {withdrawal.amount.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">{withdrawal.reason}</p>
                      {withdrawal.phone_number && (
                        <p className="text-sm text-muted-foreground">Phone: {withdrawal.phone_number}</p>
                      )}
                    </div>
                    <Badge variant="outline">{withdrawal.status}</Badge>
                  </div>

                  {/* Signatory Status */}
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    {withdrawal.withdrawal_signatories?.map((sig: any) => (
                      <div key={sig.id} className="flex items-center gap-2">
                        {sig.status === 'approved' ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : sig.status === 'rejected' ? (
                          <XCircle className="h-4 w-4 text-red-600" />
                        ) : (
                          <Clock className="h-4 w-4 text-yellow-600" />
                        )}
                        <span className="capitalize">{sig.signatory_role}</span>
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  {withdrawal.withdrawal_signatories?.find(
                    (s: any) => s.signatory_role === 'secretary' && s.status === 'pending'
                  ) && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedWithdrawal(withdrawal);
                          setApprovalAction('approve');
                          setShowApprovalDialog(true);
                        }}
                        className="flex-1"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setSelectedWithdrawal(withdrawal);
                          setApprovalAction('reject');
                          setShowApprovalDialog(true);
                        }}
                        className="flex-1"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction === 'approve' ? 'Approve Withdrawal' : 'Reject Withdrawal'}
            </DialogTitle>
          </DialogHeader>
          {selectedWithdrawal && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="text-lg font-semibold">KES {selectedWithdrawal.amount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reason</p>
                <p className="text-sm">{selectedWithdrawal.reason}</p>
              </div>
              {approvalAction === 'reject' && (
                <div>
                  <Label>Rejection Reason</Label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Please provide a reason for rejection..."
                    rows={3}
                  />
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowApprovalDialog(false);
                    setSelectedWithdrawal(null);
                    setRejectionReason('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleApproval(approvalAction!)}
                  disabled={processing}
                  className={approvalAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                >
                  {processing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                  ) : (
                    approvalAction === 'approve' ? 'Approve' : 'Reject'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}