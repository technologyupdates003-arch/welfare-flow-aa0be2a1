import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export default function AdminNotifications() {
  const [target, setTarget] = useState("all");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [alsoSms, setAlsoSms] = useState(true);

  const { data: members } = useQuery({
    queryKey: ["all-members-notif"],
    queryFn: async () => {
      const { data } = await supabase.from("members").select("id, name, phone, user_id").eq("is_active", true);
      return data || [];
    },
  });

  const sendNotification = useMutation({
    mutationFn: async () => {
      const targets = target === "all" ? members : members?.filter(m => m.id === target);
      if (!targets?.length) throw new Error("No targets");
      const notifs = targets.filter(m => m.user_id).map(m => ({
        user_id: m.user_id!,
        title,
        message,
        type: "info",
      }));
      if (notifs.length) {
        const { error } = await supabase.from("notifications").insert(notifs);
        if (error) throw error;
      }
      if (alsoSms) {
        const phones = targets.map(m => m.phone).filter(Boolean);
        if (phones.length) {
          await supabase.functions.invoke("send-bulk-sms", {
            body: { phones, message: `${title}: ${message}`.slice(0, 320) },
          });
        }
      }
    },
    onSuccess: () => {
      toast.success("Notifications sent");
      setTitle("");
      setMessage("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader><CardTitle>Send Notifications</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger><SelectValue placeholder="Select target" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Members</SelectItem>
            {members?.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
        <Textarea placeholder="Message" rows={3} value={message} onChange={e => setMessage(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={alsoSms} onCheckedChange={(v) => setAlsoSms(!!v)} />
          Also send via SMS
        </label>
        <Button onClick={() => sendNotification.mutate()} disabled={!title || !message || sendNotification.isPending}>
          {sendNotification.isPending ? "Sending..." : "Send Notification"}
        </Button>
      </CardContent>
    </Card>
  );
}
