import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, AlertTriangle, TrendingUp, Calendar } from "lucide-react";
import StatsCards from "@/components/admin/StatsCards";

export default function ChairpersonDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["chairperson-stats"],
    queryFn: async () => {
      const [membersRes, paymentsRes, defaultersRes, eventsRes] = await Promise.all([
        supabase.from("members").select("id, is_active").eq("is_active", true),
        supabase.from("payments").select("amount").eq("matched", true),
        supabase.from("members").select("id, name, total_penalties").gt("total_penalties", 0),
        supabase.from("events").select("id").eq("status", "active"),
      ]);

      const totalCollected = paymentsRes.data?.reduce((sum, p) => sum + p.amount, 0) || 0;
      
      return {
        activeMembers: membersRes.data?.length || 0,
        totalCollected,
        defaulters: defaultersRes.data?.length || 0,
        activeEvents: eventsRes.data?.length || 0,
        defaultersList: defaultersRes.data || [],
      };
    },
  });

  const { data: recentPayments } = useQuery({
    queryKey: ["recent-payments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select(`
          *,
          members:member_id (name, phone)
        `)
        .eq("matched", true)
        .order("received_at", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Chairperson Dashboard</h1>
        <Badge variant="secondary" className="text-sm">Read Only Access</Badge>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeMembers || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {(stats?.totalCollected || 0).toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Defaulters</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats?.defaulters || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Events</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeEvents || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Defaulters List */}
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Penalties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats?.defaultersList?.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell className="text-destructive font-medium">
                        KES {Number(member.total_penalties).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Payments */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {recentPayments?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No recent payments</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPayments?.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">
                        {payment.members?.name || "Unknown"}
                      </TableCell>
                      <TableCell>KES {payment.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        {new Date(payment.received_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}