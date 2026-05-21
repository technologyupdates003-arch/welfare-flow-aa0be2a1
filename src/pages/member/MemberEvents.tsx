import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useEffect, useState } from "react";

export default function MemberEvents() {
  const [now, setNow] = useState(new Date());

  // Update current time every minute for real-time filtering
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

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

  // Filter out events with passed scheduled dates
  const visibleEvents = (events || []).filter((event: any) => {
    if (!event.scheduled_date) return true; // Show if no scheduled date
    const schedDate = new Date(event.rescheduled_date || event.scheduled_date);
    return schedDate >= now; // Only show if date hasn't passed
  });

  const typeLabel = (t: string) => t === "funeral" ? "⚰️ Funeral" : t === "fee" ? "💰 Fee" : "📋 " + t;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Events</h3>
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : visibleEvents?.length === 0 ? (
        <p className="text-muted-foreground text-sm">No active events at this time.</p>
      ) : (
        visibleEvents?.map((ev: any) => {
          const schedDate = ev.rescheduled_date || ev.scheduled_date;
          const daysUntil = schedDate ? Math.ceil((new Date(schedDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
          
          return (
            <Card key={ev.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{ev.title}</CardTitle>
                  {schedDate && daysUntil !== null && (
                    <Badge variant={daysUntil <= 1 ? "destructive" : daysUntil <= 7 ? "secondary" : "outline"}>
                      {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil}d`}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {typeLabel(ev.event_type)} · {format(new Date(ev.created_at), "dd MMM yyyy")}
                  {schedDate && ` · Scheduled: ${format(new Date(schedDate), "dd MMM yyyy HH:mm")}`}
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {ev.departed_name && <p className="text-sm"><span className="text-muted-foreground">Departed:</span> {ev.departed_name} ({ev.relationship})</p>}
                {ev.description && <p className="text-sm text-muted-foreground">{ev.description}</p>}
                <p className="text-sm font-medium">Contribution: KES {Number(ev.contribution_amount).toLocaleString()}</p>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
