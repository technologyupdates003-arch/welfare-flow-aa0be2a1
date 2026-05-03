import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, Calendar, Shield, Award, AlertCircle } from "lucide-react";

export default function PatronDashboard() {
  const { data: overallStats } = useQuery({
    queryKey: ["patron-overall-stats"],
    queryFn: async () => {
      const [membersRes, paymentsRes, eventsRes, rolesRes] = await Promise.all([
        supabase.from("members").select("id, is_active, total_contributions, total_penalties"),
        supabase.from("payments").select("amount, received_at").eq("matched", true),
        supabase.from("events").select("id, status, event_type"),
        supabase.from("user_roles").select("role"),
      ]);

      const totalMembers = membersRes.data?.length || 0;
      const activeMembers = membersRes.data?.filter(m => m.is_active).length || 0;
      const totalCollected = paymentsRes.data?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const totalEvents = eventsRes.data?.length || 0;
      const activeEvents = eventsRes.data?.filter(e => e.status === "active").length || 0;
      
      // Calculate monthly collection trend
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const thisMonthPayments = paymentsRes.data?.filter(p => {
        const paymentDate = new Date(p.received_at);
        return paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear;
      }) || [];
      const thisMonthTotal = thisMonthPayments.reduce((sum, p) => sum + p.amount, 0);

      // Role distribution
      const roleDistribution = rolesRes.data?.reduce((acc, r) => {
        acc[r.role] = (acc[r.role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      return {
        totalMembers,
        activeMembers,
        totalCollected,
        totalEvents,
        activeEvents,
        thisMonthTotal,
        roleDistribution,
        membersList: membersRes.data || [],
      };
    },
  });

  const { data: performanceMetrics } = useQuery({
    queryKey: ["performance-metrics"],
    queryFn: async () => {
      const { data: contributions } = await supabase
        .from("contributions")
        .select("status, amount, due_date");
      
      if (!contributions) return { paymentRate: 0, avgContribution: 0, overdueCount: 0 };
      
      const paidContributions = contributions.filter(c => c.status === "paid");
      const paymentRate = contributions.length > 0 ? (paidContributions.length / contributions.length) * 100 : 0;
      const avgContribution = paidContributions.length > 0 
        ? paidContributions.reduce((sum, c) => sum + c.amount, 0) / paidContributions.length 
        : 0;
      
      const now = new Date();
      const overdueCount = contributions.filter(c => 
        c.status !== "paid" && new Date(c.due_date) < now
      ).length;
      
      return { paymentRate, avgContribution, overdueCount };
    },
  });

  const { data: recentActivities } = useQuery({
    queryKey: ["recent-activities"],
    queryFn: async () => {
      const [eventsRes, paymentsRes, membersRes] = await Promise.all([
        supabase
          .from("events")
          .select("id, title, created_at, event_type")
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("payments")
          .select(`
            id, amount, received_at,
            members:member_id (name)
          `)
          .eq("matched", true)
          .order("received_at", { ascending: false })
          .limit(3),
        supabase
          .from("members")
          .select("id, name, created_at")
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      const activities = [
        ...(eventsRes.data || []).map(e => ({
          type: "event",
          title: `New Event: ${e.title}`,
          subtitle: e.event_type.replace("_", " "),
          date: e.created_at,
          icon: "calendar",
        })),
        ...(paymentsRes.data || []).map(p => ({
          type: "payment",
          title: `Payment Received: KES ${p.amount.toLocaleString()}`,
          subtitle: `from ${p.members?.name || "Unknown"}`,
          date: p.received_at,
          icon: "trending-up",
        })),
        ...(membersRes.data || []).map(m => ({
          type: "member",
          title: `New Member: ${(m as any).name}`,
          subtitle: "Joined the welfare",
          date: m.created_at,
          icon: "users",
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6);

      return activities;
    },
  });

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case "calendar": return <Calendar className="h-4 w-4 text-blue-600" />;
      case "trending-up": return <TrendingUp className="h-4 w-4 text-green-600" />;
      case "users": return <Users className="h-4 w-4 text-purple-600" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Patron Dashboard</h1>
        <Badge variant="default" className="text-sm flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Oversight & Governance
        </Badge>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats?.totalMembers || 0}</div>
            <p className="text-xs text-muted-foreground">
              {overallStats?.activeMembers || 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              KES {(overallStats?.totalCollected || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              KES {(overallStats?.thisMonthTotal || 0).toLocaleString()} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payment Rate</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(performanceMetrics?.paymentRate || 0).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {performanceMetrics?.overdueCount || 0} overdue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Events</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats?.activeEvents || 0}</div>
            <p className="text-xs text-muted-foreground">
              {overallStats?.totalEvents || 0} total events
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Role Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Role Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(overallStats?.roleDistribution || {}).length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No role data available</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(overallStats?.roleDistribution || {}).map(([role, count]) => (
                  <div key={role} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium capitalize">
                        {role.replace("_", " ")}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {count} user{count !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivities?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No recent activities</p>
            ) : (
              <div className="space-y-3">
                {recentActivities?.map((activity, index) => (
                  <div key={index} className="flex items-center gap-3 p-2 border rounded-lg">
                    <div className="flex-shrink-0">
                      {getIconComponent(activity.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{activity.title}</div>
                      <div className="text-sm text-muted-foreground">{activity.subtitle}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(activity.date).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Member Performance Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Member Performance Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {overallStats?.membersList?.filter(m => m.total_penalties === 0).length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Members with No Penalties</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                KES {(performanceMetrics?.avgContribution || 0).toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Average Contribution</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {overallStats?.membersList?.filter(m => m.total_penalties > 0).length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Members with Penalties</div>
            </div>
          </div>
          
          {overallStats?.membersList?.filter(m => m.total_penalties > 0).length > 0 && (
            <div>
              <h4 className="font-medium mb-3 text-destructive">Members Requiring Attention</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Total Contributions</TableHead>
                    <TableHead>Penalties</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overallStats?.membersList
                    ?.filter(m => m.total_penalties > 0)
                    .slice(0, 5)
                    .map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">{member.name}</TableCell>
                        <TableCell>KES {member.total_contributions.toLocaleString()}</TableCell>
                        <TableCell className="text-destructive font-medium">
                          KES {member.total_penalties.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={member.is_active ? "default" : "secondary"}>
                            {member.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}