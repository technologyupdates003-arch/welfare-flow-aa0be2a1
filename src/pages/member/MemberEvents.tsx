import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function MemberEvents() {
  const { data: events, isLoading } = useQuery({
    queryKey: ["member-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const typeLabel = (t: string) => t === "funeral" ? "⚰️ Funeral" : t === "fee" ? "💰 Fee" : "📋 " + t;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Events</h3>
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : events?.length === 0 ? (
        <p className="text-muted-foreground text-sm">No events posted yet.</p>
      ) : (
        events?.map((ev: any) => (
          <Card key={ev.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{ev.title}</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground">{typeLabel(ev.event_type)} · {format(new Date(ev.created_at), "dd MMM yyyy")}</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {ev.departed_name && <p className="text-sm"><span className="text-muted-foreground">Departed:</span> {ev.departed_name} ({ev.relationship})</p>}
              {ev.description && <p className="text-sm text-muted-foreground">{ev.description}</p>}
              <p className="text-sm font-medium">Contribution: KES {Number(ev.contribution_amount).toLocaleString()}</p>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
