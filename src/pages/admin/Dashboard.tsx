import StatsCards from "@/components/admin/StatsCards";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, LayoutDashboard } from "lucide-react";
import { Link } from "react-router-dom";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

export default function AdminDashboard() {
  const { data: recentContribs } = useQuery({
    queryKey: ["recent-contributions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contributions")
        .select("*, members(name, phone)")
        .order("updated_at", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  const { data: latestNews = [] } = useQuery({
    queryKey: ["latest-news-admin-dashboard"],
    queryFn: async () => {
      const { data } = await supabase
        .from("news")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(3);
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Admin Dashboard"
        subtitle="Members, contributions, and welfare operations at a glance"
        icon={LayoutDashboard}
        badge="Admin Access"
      />
      <StatsCards />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Contribution Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentContribs?.length === 0 && (
                <p className="text-muted-foreground text-sm">No contributions yet. Import members via Excel to get started.</p>
              )}
              {recentContribs?.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="font-medium text-sm">{c.members?.name}</p>
                    <p className="text-xs text-muted-foreground">{c.members?.phone} · {c.month}/{c.year}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">KES {Number(c.amount).toLocaleString()}</span>
                    <Badge variant={c.status === "paid" ? "default" : c.status === "overdue" ? "destructive" : "secondary"}>
                      {c.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Latest News</CardTitle>
            <Link to="/admin/news" className="text-xs text-primary hover:underline flex items-center gap-1">
              View All <ChevronRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {latestNews.length === 0 ? (
              <p className="text-muted-foreground text-sm">No news published yet.</p>
            ) : (
              <div className="space-y-3">
                {latestNews.map((news: any) => (
                  <div key={news.id} className="border-b border-border last:border-0 pb-3 last:pb-0">
                    <h4 className="font-medium text-sm line-clamp-1">{news.title}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {news.content}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(news.created_at).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
