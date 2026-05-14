import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Search } from "lucide-react";
import { toast } from "sonner";

type Member = { id: string; name: string; phone: string };

export default function BulkSms() {
  const [filter, setFilter] = useState<"all" | "defaulters">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["members-for-sms", filter],
    queryFn: async () => {
      if (filter === "defaulters") {
        const { data: overdue } = await supabase
          .from("contributions").select("member_id").eq("status", "overdue");
        const ids = [...new Set((overdue || []).map(c => c.member_id))];
        if (!ids.length) return [];
        const { data } = await supabase.from("members")
          .select("id, name, phone").in("id", ids).eq("is_active", true);
        return data || [];
      }
      const { data } = await supabase.from("members")
        .select("id, name, phone").eq("is_active", true).order("name");
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(m =>
      m.name?.toLowerCase().includes(q) || m.phone?.includes(q),
    );
  }, [members, search]);

  const allVisibleSelected = filtered.length > 0 && filtered.every(m => selected.has(m.id));

  const toggleAll = () => {
    const next = new Set(selected);
    if (allVisibleSelected) filtered.forEach(m => next.delete(m.id));
    else filtered.forEach(m => next.add(m.id));
    setSelected(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const recipients = members.filter(m => selected.has(m.id));

  const sendBulk = async () => {
    if (!recipients.length || !message.trim()) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-bulk-sms", {
        body: { phones: recipients.map(m => m.phone), message: message.trim() },
      });
      if (error) throw error;
      const res: any = data;
      if (res?.status === "failed") {
        if (res.insufficient_balance) {
          toast.error("SMS provider has insufficient balance. Please top up the ABANCOOL account.");
        } else {
          toast.error(res.error || "SMS provider rejected the request");
        }
        return;
      }
      toast.success(`SMS sent to ${res?.count ?? recipients.length} recipients`);
      setMessage("");
      setSelected(new Set());
    } catch (e: any) {
      toast.error(e.message || "Failed to send SMS");
    }
    setSending(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk SMS</CardTitle>
        <CardDescription>Search members, select recipients, and send SMS via ABANCOOL</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={filter} onValueChange={(v: any) => { setFilter(v); setSelected(new Set()); }}>
            <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Members</SelectItem>
              <SelectItem value="defaulters">Defaulters Only</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by name or phone..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2">
            <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} />
            Select all ({filtered.length})
          </label>
          <span className="text-muted-foreground">{selected.size} selected</span>
        </div>

        <div className="border rounded-md max-h-72 overflow-y-auto divide-y">
          {filtered.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">No members</div>
          ) : filtered.map(m => (
            <label key={m.id} className="flex items-center gap-3 p-2 hover:bg-muted/40 cursor-pointer">
              <Checkbox checked={selected.has(m.id)} onCheckedChange={() => toggleOne(m.id)} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{m.name}</div>
                <div className="text-xs text-muted-foreground">{m.phone}</div>
              </div>
            </label>
          ))}
        </div>

        <Textarea placeholder="Type your message..." rows={4}
          value={message} onChange={e => setMessage(e.target.value)} />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{message.length} chars</span>
          <Button onClick={sendBulk} disabled={sending || !message.trim() || !recipients.length}>
            <Send className="h-4 w-4 mr-2" />
            {sending ? "Sending..." : `Send to ${recipients.length}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
