import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, AlertTriangle, TrendingUp, Calendar, FileText, ShieldCheck } from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { GlassStatsGrid } from "@/components/dashboard/GlassStatCard";

export default function ViceChairpersonDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["vice-chairperson-stats"],
    queryFn: async () => {
      const [membersRes, paymentsRes, defaultersRes, eventsRes, documentsRes] = await Promise.all([
        supabase.from("members").select("id, is_active").eq("is_active", true),
        supabase.from("payments").select("amount").eq("matched", true),
        supabase.from("members").select("id, name, total_penalties").gt("total_penalties", 0),
        supabase.from("events").select("id").eq("status", "active"),
        supabase.from("documents").select("id"),
      ]);

      const totalCollected = paymentsRes.data?.reduce((sum, p) => sum + p.amount, 0) || 0;
      
      return {
        activeMembers: membersRes.data?.length || 0,
        totalCollected,
        defaulters: defaultersRes.data?.length || 0,
        activeEvents: eventsRes.data?.length || 0,
        totalDocuments: documentsRes.data?.length || 0,
        defaultersList: defaultersRes.data || [],
      };
    },
  });

  const { data: recentEvents } = useQuery({
    queryKey: ["recent-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select(`
          *,
          members:related_member_id (name)
        `)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const { data: memberStats } = useQuery({
    queryKey: ["member-statistics"],
    queryFn: async () => {
      const { data } = await supabase
        .from("members")
        .select("total_contributions, total_penalties, is_active");
      
      if (!data) return { avgContributions: 0, totalPenalties: 0 };
      
      const activeMembers = data.filter(m => m.is_active);
      const avgContributions = activeMembers.length > 0 
        ? activeMembers.reduce((sum, m) => sum + m.total_contributions, 0) / activeMembers.length 
        : 0;
      const totalPenalties = data.reduce((sum, m) => sum + m.total_penalties, 0);
      
      return { avgContributions, totalPenalties };
    },
  });

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Vice Chairperson Dashboard"
        subtitle="Support governance and oversight"
        icon={ShieldCheck}
        badge="Read Only Access"
      />

      {/* Stats Overview */}
      <GlassStatsGrid
        cols="grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        stats={[
          { label: "Active Members", value: stats?.activeMembers || 0, icon: Users, sub: "Registered", accent: "from-primary/30 to-primary-glow/10" },
          { label: "Total Collected", value: `KES ${(stats?.totalCollected || 0).toLocaleString()}`, icon: TrendingUp, sub: "All time", accent: "from-success/30 to-success/5" },
          { label: "Avg Contributions", value: `KES ${(memberStats?.avgContributions || 0).toLocaleString()}`, icon: TrendingUp, sub: "Per member", accent: "from-secondary/30 to-secondary/5" },
          { label: "Active Events", value: stats?.activeEvents || 0, icon: Calendar, sub: "Currently open", accent: "from-primary/30 to-primary-glow/10" },
          { label: "Documents", value: stats?.totalDocuments || 0, icon: FileText, sub: "Uploaded", accent: "from-secondary/30 to-secondary/5" },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Recent Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentEvents?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No recent events</p>
            ) : (
              <div className="space-y-3">
                {recentEvents?.map((event) => (
                  <div key={event.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{event.title}</h4>
                      <Badge variant="outline">
                        {event.event_type.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {event.description || "No description"}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span>KES {event.contribution_amount.toLocaleString()}</span>
                      <span>{new Date(event.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Defaulters Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Members with Penalties
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.defaultersList?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No members with penalties</p>
            ) : (
              <>
                <div className="mb-4 p-3 bg-destructive/10 rounded-lg">
                  <div className="text-sm text-muted-foreground">Total Penalties Outstanding</div>
                  <div className="text-2xl font-bold text-destructive">
                    KES {(memberStats?.totalPenalties || 0).toLocaleString()}
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Penalties</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats?.defaultersList?.slice(0, 5).map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">{member.name}</TableCell>
                        <TableCell className="text-destructive font-medium">
                          KES {Number(member.total_penalties).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {(stats?.defaultersList?.length || 0) > 5 && (
                  <p className="text-sm text-muted-foreground mt-2 text-center">
                    And {(stats?.defaultersList?.length || 0) - 5} more members with penalties
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}