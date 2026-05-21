import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";

export default function MemberNews() {
  const [now, setNow] = useState(new Date());

  // Update current time every minute for real-time filtering
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const { data: news } = useQuery({
    queryKey: ["news"],
    queryFn: async () => {
      const { data } = await supabase
        .from("news")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Filter out news with passed scheduled dates
  const visibleNews = (news || []).filter((item: any) => {
    if (!item.scheduled_date) return true; // Show if no scheduled date
    const schedDate = new Date(item.rescheduled_date || item.scheduled_date);
    return schedDate >= now; // Only show if date hasn't passed
  });

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-display font-bold">News & Announcements</h2>
      {visibleNews?.map(n => {
        const schedDate = n.rescheduled_date || n.scheduled_date;
        const daysUntil = schedDate ? Math.ceil((new Date(schedDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
        
        return (
          <Card key={n.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{n.title}</CardTitle>
                {schedDate && daysUntil !== null && (
                  <Badge variant={daysUntil <= 1 ? "destructive" : daysUntil <= 7 ? "secondary" : "outline"}>
                    {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil}d`}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{n.content}</p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleDateString()}</p>
                {schedDate && (
                  <p className="text-xs text-orange-600 font-medium">
                    Scheduled: {new Date(schedDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
      {visibleNews?.length === 0 && <p className="text-muted-foreground">No announcements at this time</p>}
    </div>
  );
}
