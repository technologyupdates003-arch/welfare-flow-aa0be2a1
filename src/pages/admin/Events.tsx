import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Events() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    event_type: "funeral",
    departed_name: "",
    relationship: "member",
    related_member_id: "",
    contribution_amount: "",
    status: "active",
    scheduled_date: "",
    rescheduled_date: "",
    reschedule_reason: "",
  });

  const { data: events, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, members:related_member_id(name, phone)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: members } = useQuery({
    queryKey: ["members-list"],
    queryFn: async () => {
      const { data } = await supabase.from("members").select("id, name, phone").order("name");
      return data || [];
    },
  });

  const createEvent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("events").insert({
        title: form.title,
        description: form.description || null,
        event_type: form.event_type,
        departed_name: form.departed_name || null,
        relationship: form.relationship,
        related_member_id: form.related_member_id || null,
        contribution_amount: Number(form.contribution_amount) || 0,
        status: form.status,
        scheduled_date: form.scheduled_date ? new Date(form.scheduled_date).toISOString() : null,
        created_by: user!.id,
      });
      if (error) throw error;

      // Notify all active members in-app + via SMS
      const { data: activeMembers } = await supabase
        .from("members")
        .select("user_id, phone")
        .eq("is_active", true);

      const notifs = (activeMembers || [])
        .filter((m: any) => m.user_id && m.user_id !== user!.id)
        .map((m: any) => ({
          user_id: m.user_id,
          title: `📅 New Event: ${form.title}`,
          message: form.description || `${form.event_type} event created`,
          type: "event",
        }));
      if (notifs.length) await supabase.from("notifications").insert(notifs);

      const phones = (activeMembers || []).map((m: any) => m.phone).filter(Boolean);
      if (phones.length) {
        const sms = `KHCWW Event: ${form.title}${form.scheduled_date ? ` on ${new Date(form.scheduled_date).toLocaleDateString()}` : ""}. ${form.contribution_amount ? `Contribution: KES ${form.contribution_amount}.` : ""}`.trim();
        supabase.functions.invoke("send-bulk-sms", { body: { phones, message: sms } }).catch(() => {});
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Event created successfully");
      setOpen(false);
      setForm({ title: "", description: "", event_type: "funeral", departed_name: "", relationship: "member", related_member_id: "", contribution_amount: "", status: "active", scheduled_date: "", rescheduled_date: "", reschedule_reason: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("events").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Status updated");
    },
  });

  const statusColor = (s: string) => s === "active" ? "default" : s === "closed" ? "secondary" : "destructive";
  const typeLabel = (t: string) => t === "funeral" ? "⚰️ Funeral" : t === "fee" ? "💰 Fee" : "📋 " + t;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Events Management</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> New Event</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Event</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Event Type</Label>
                <Select value={form.event_type} onValueChange={v => setForm(f => ({ ...f, event_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="funeral">Funeral</SelectItem>
                    <SelectItem value="fee">Fee Collection</SelectItem>
                    <SelectItem value="medical">Medical Emergency</SelectItem>
                    <SelectItem value="wedding">Wedding</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Title</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Funeral of John Doe" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Details about the event..." />
              </div>
              {form.event_type === "funeral" && (
                <>
                  <div>
                    <Label>Name of the Departed</Label>
                    <Input value={form.departed_name} onChange={e => setForm(f => ({ ...f, departed_name: e.target.value }))} placeholder="Full name" />
                  </div>
                  <div>
                    <Label>Relationship</Label>
                    <Select value={form.relationship} onValueChange={v => setForm(f => ({ ...f, relationship: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member (Deceased)</SelectItem>
                        <SelectItem value="spouse">Spouse of Member</SelectItem>
                        <SelectItem value="child">Child of Member</SelectItem>
                        <SelectItem value="parent">Parent of Member</SelectItem>
                        <SelectItem value="sibling">Sibling of Member</SelectItem>
                        <SelectItem value="other_relative">Other Relative</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div>
                <Label>Related Member</Label>
                <Select value={form.related_member_id} onValueChange={v => setForm(f => ({ ...f, related_member_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                  <SelectContent>
                    {members?.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name} ({m.phone})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Contribution Amount (KES)</Label>
                <Input type="number" value={form.contribution_amount} onChange={e => setForm(f => ({ ...f, contribution_amount: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <Label>Scheduled Date (Optional)</Label>
                <Input 
                  type="datetime-local" 
                  value={form.scheduled_date} 
                  onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} 
                />
              </div>
              <Button className="w-full" onClick={() => createEvent.mutate()} disabled={!form.title || createEvent.isPending}>
                {createEvent.isPending ? "Creating..." : "Create Event"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-muted-foreground">Loading...</div>
          ) : events?.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">No events yet. Create one to get started.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Departed / Details</TableHead>
                  <TableHead>Related Member</TableHead>
                  <TableHead>Amount (KES)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled Date</TableHead>
                  <TableHead>Date Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events?.map((ev: any) => (
                  <TableRow key={ev.id}>
                    <TableCell className="text-sm">{typeLabel(ev.event_type)}</TableCell>
                    <TableCell className="font-medium text-sm">{ev.title}</TableCell>
                    <TableCell className="text-sm">{ev.departed_name || "-"}<br /><span className="text-xs text-muted-foreground">{ev.relationship}</span></TableCell>
                    <TableCell className="text-sm">{ev.members?.name || "-"}</TableCell>
                    <TableCell className="text-sm font-medium">{Number(ev.contribution_amount).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={statusColor(ev.status)}>{ev.status}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ev.scheduled_date ? format(new Date(ev.scheduled_date), "dd MMM yyyy") : "-"}
                      {ev.rescheduled_date && (
                        <div className="text-orange-600 text-xs mt-1">
                          Rescheduled: {format(new Date(ev.rescheduled_date), "dd MMM yyyy")}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(ev.created_at), "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      {ev.status === "active" && (
                        <Button variant="outline" size="sm" onClick={() => updateStatus.mutate({ id: ev.id, status: "closed" })}>Close</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
