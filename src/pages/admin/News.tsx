import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";

export default function AdminNews() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [rescheduledDate, setRescheduledDate] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [selectedNews, setSelectedNews] = useState<any>(null);

  const { data: news } = useQuery({
    queryKey: ["news"],
    queryFn: async () => {
      const { data } = await supabase.from("news").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const createNews = useMutation({
    mutationFn: async () => {
      const { data: newsItem, error } = await supabase.from("news").insert({ 
        title, 
        content, 
        author_id: user!.id,
        scheduled_date: scheduledDate ? new Date(scheduledDate).toISOString() : null,
      }).select("id").single();
      if (error) throw error;

      // Notify all active members in-app + via SMS
      const { data: allMembers } = await supabase
        .from("members")
        .select("user_id, phone")
        .eq("is_active", true);
      if (allMembers && allMembers.length > 0) {
        const notifications = allMembers
          .filter((m: any) => m.user_id && m.user_id !== user!.id)
          .map((m: any) => ({
            user_id: m.user_id,
            title: `📢 ${title}`,
            message: content.length > 100 ? content.substring(0, 100) + "..." : content,
            type: "news",
          }));
        if (notifications.length > 0) {
          await supabase.from("notifications").insert(notifications);
        }
        const phones = allMembers.map((m: any) => m.phone).filter(Boolean);
        if (phones.length) {
          const sms = `KHCWW: ${title} - ${content}`.slice(0, 320);
          supabase.functions.invoke("send-bulk-sms", { body: { phones, message: sms } }).catch(() => {});
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news"] });
      setOpen(false);
      setTitle("");
      setContent("");
      setScheduledDate("");
      setRescheduledDate("");
      setRescheduleReason("");
      toast.success("Announcement posted & members notified");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateNews = useMutation({
    mutationFn: async () => {
      if (!selectedNews) return;
      const { error } = await supabase
        .from("news")
        .update({ 
          title, 
          content, 
          scheduled_date: scheduledDate ? new Date(scheduledDate).toISOString() : null,
          rescheduled_date: rescheduledDate ? new Date(rescheduledDate).toISOString() : null,
          reschedule_reason: rescheduleReason || null,
          updated_at: new Date().toISOString() 
        })
        .eq("id", selectedNews.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news"] });
      setEditOpen(false);
      setSelectedNews(null);
      setTitle("");
      setContent("");
      setScheduledDate("");
      setRescheduledDate("");
      setRescheduleReason("");
      toast.success("Announcement updated successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteNews = useMutation({
    mutationFn: async () => {
      if (!selectedNews) return;
      const { error } = await supabase
        .from("news")
        .delete()
        .eq("id", selectedNews.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news"] });
      setDeleteOpen(false);
      setSelectedNews(null);
      toast.success("Announcement deleted successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archiveNews = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("news")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news"] });
      toast.success("Announcement status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleEdit = (newsItem: any) => {
    setSelectedNews(newsItem);
    setTitle(newsItem.title);
    setContent(newsItem.content);
    setScheduledDate(newsItem.scheduled_date ? new Date(newsItem.scheduled_date).toISOString().slice(0, 16) : "");
    setRescheduledDate(newsItem.rescheduled_date ? new Date(newsItem.rescheduled_date).toISOString().slice(0, 16) : "");
    setRescheduleReason(newsItem.reschedule_reason || "");
    setEditOpen(true);
  };

  const handleDelete = (newsItem: any) => {
    setSelectedNews(newsItem);
    setDeleteOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> New Announcement</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Post Announcement</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
              <Textarea placeholder="Content" rows={4} value={content} onChange={e => setContent(e.target.value)} />
              <div>
                <label className="text-sm font-medium">Scheduled Date (Optional)</label>
                <Input 
                  type="datetime-local" 
                  value={scheduledDate} 
                  onChange={e => setScheduledDate(e.target.value)} 
                />
              </div>
              <Button onClick={() => createNews.mutate()} disabled={!title || !content || createNews.isPending} className="w-full">
                {createNews.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Posting...</> : "Post"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {news?.map(n => (
          <Card key={n.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{n.title}</CardTitle>
                  <Badge variant={n.status === "active" ? "default" : "secondary"}>
                    {n.status === "active" ? "Active" : "Archived"}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(n)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => archiveNews.mutate({ id: n.id, status: n.status === "active" ? "archived" : "active" })}
                  className={n.status === "active" ? "text-orange-600 hover:text-orange-700" : "text-green-600 hover:text-green-700"}
                >
                  {n.status === "active" ? "Archive" : "Restore"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(n)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{n.content}</p>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <p>Posted: {new Date(n.created_at).toLocaleDateString()}</p>
                {n.scheduled_date && (
                  <p className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Scheduled: {new Date(n.scheduled_date).toLocaleDateString()}
                  </p>
                )}
                {n.rescheduled_date && (
                  <p className="flex items-center gap-1 text-orange-600">
                    <Calendar className="h-3 w-3" />
                    Rescheduled: {new Date(n.rescheduled_date).toLocaleDateString()}
                    {n.reschedule_reason && ` - ${n.reschedule_reason}`}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Announcement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Content</label>
              <Textarea rows={4} value={content} onChange={e => setContent(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Scheduled Date (Optional)</label>
              <Input 
                type="datetime-local" 
                value={scheduledDate} 
                onChange={e => setScheduledDate(e.target.value)} 
              />
            </div>
            <div>
              <label className="text-sm font-medium">Rescheduled Date (Optional)</label>
              <Input 
                type="datetime-local" 
                value={rescheduledDate} 
                onChange={e => setRescheduledDate(e.target.value)} 
              />
            </div>
            {rescheduledDate && (
              <div>
                <label className="text-sm font-medium">Reschedule Reason (Optional)</label>
                <Textarea 
                  rows={2}
                  placeholder="Why was this rescheduled?"
                  value={rescheduleReason} 
                  onChange={e => setRescheduleReason(e.target.value)} 
                />
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditOpen(false);
                  setSelectedNews(null);
                  setTitle("");
                  setContent("");
                  setScheduledDate("");
                  setRescheduledDate("");
                  setRescheduleReason("");
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => updateNews.mutate()}
                disabled={!title || !content || updateNews.isPending}
                className="flex-1"
              >
                {updateNews.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating...</> : "Update"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Announcement</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this announcement? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedNews && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium text-sm">{selectedNews.title}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{selectedNews.content}</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteOpen(false);
                  setSelectedNews(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteNews.mutate()}
                disabled={deleteNews.isPending}
                className="flex-1"
              >
                {deleteNews.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting...</> : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
