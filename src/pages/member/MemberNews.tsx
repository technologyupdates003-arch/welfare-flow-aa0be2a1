import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MemberNews() {
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

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-display font-bold">News & Announcements</h2>
      {news?.map(n => (
        <Card key={n.id}>
          <CardHeader><CardTitle className="text-base">{n.title}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{n.content}</p>
            <p className="text-xs text-muted-foreground mt-2">{new Date(n.created_at).toLocaleDateString()}</p>
          </CardContent>
        </Card>
      ))}
      {news?.length === 0 && <p className="text-muted-foreground">No announcements yet</p>}
    </div>
  );
}
