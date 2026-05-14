import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, FileText, Users, MessageSquare, Bell, ClipboardList } from "lucide-react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { GlassStatsGrid } from "@/components/dashboard/GlassStatCard";

export default function ViceSecretaryDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["vice-secretary-stats"],
    queryFn: async () => {
      const [eventsRes, documentsRes, membersRes, messagesRes, notificationsRes] = await Promise.all([
        supabase.from("events").select("id, status"),
        supabase.from("documents").select("id, status"),
        supabase.from("members").select("id").eq("is_active", true),
        supabase.from("messages").select("id").order("created_at", { ascending: false }).limit(100),
        supabase.from("notifications").select("id, is_read"),
      ]);

      return {
        totalEvents: eventsRes.data?.length || 0,
        activeEvents: eventsRes.data?.filter(e => e.status === "active").length || 0,
        totalDocuments: documentsRes.data?.length || 0,
        pendingDocuments: documentsRes.data?.filter(d => d.status === "pending").length || 0,
        totalMembers: membersRes.data?.length || 0,
        recentMessages: messagesRes.data?.length || 0,
        unreadNotifications: notificationsRes.data?.filter(n => !n.is_read).length || 0,
      };
    },
  });

  const { data: recentDocuments } = useQuery({
    queryKey: ["recent-documents"],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select(`
          *,
          members:member_id (name)
        `)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  const { data: eventsSummary } = useQuery({
    queryKey: ["events-summary"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("event_type, status")
        .eq("status", "active");
      
      if (!data) return {};
      
      const summary = data.reduce((acc, event) => {
        acc[event.event_type] = (acc[event.event_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      return summary;
    },
  });

  const { data: recentActivity } = useQuery({
    queryKey: ["recent-activity"],
    queryFn: async () => {
      const [eventsRes, documentsRes] = await Promise.all([
        supabase
          .from("events")
          .select("id, title, created_at, event_type")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("documents")
          .select(`
            id, file_name, created_at, status,
            members:member_id (name)
          `)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const activities = [
        ...(eventsRes.data || []).map(e => ({
          type: "event",
          title: e.title,
          subtitle: e.event_type.replace("_", " "),
          date: e.created_at,
        })),
        ...(documentsRes.data || []).map(d => ({
          type: "document",
          title: d.file_name,
          subtitle: `by ${d.members?.name || "Unknown"}`,
          date: d.created_at,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);

      return activities;
    },
  });

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Vice Secretary Dashboard"
        subtitle="Records, documentation, and member support"
        icon={ClipboardList}
        badge="Records & Documentation"
      />

      {/* Stats Overview */}
      <GlassStatsGrid
        cols="grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        stats={[
          { label: "Total Events", value: stats?.totalEvents || 0, icon: Calendar, sub: `${stats?.activeEvents || 0} active`, accent: "from-primary/30 to-primary-glow/10" },
          { label: "Documents", value: stats?.totalDocuments || 0, icon: FileText, sub: `${stats?.pendingDocuments || 0} pending`, accent: "from-secondary/30 to-secondary/5" },
          { label: "Members", value: stats?.totalMembers || 0, icon: Users, sub: "Active members", accent: "from-primary/30 to-primary-glow/10" },
          { label: "Messages", value: stats?.recentMessages || 0, icon: MessageSquare, sub: "Recent activity", accent: "from-success/30 to-success/5" },
          { label: "Notifications", value: stats?.unreadNotifications || 0, icon: Bell, sub: "Unread", accent: "from-warning/30 to-warning/5" },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Events by Type */}
        <Card>
          <CardHeader>
            <CardTitle>Active Events by Type</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(eventsSummary || {}).length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No active events</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(eventsSummary || {}).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium capitalize">{type.replace("_", " ")}</div>
                      <div className="text-sm text-muted-foreground">
                        {count} active event{count !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {recentActivity?.map((activity, index) => (
                  <div key={index} className="flex items-center gap-3 p-2 border rounded-lg">
                    <div className="flex-shrink-0">
                      {activity.type === "event" ? (
                        <Calendar className="h-4 w-4 text-blue-600" />
                      ) : (
                        <FileText className="h-4 w-4 text-green-600" />
                      )}
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

      {/* Recent Documents */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {recentDocuments?.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No documents uploaded yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Upload Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentDocuments?.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.file_name}</TableCell>
                    <TableCell>{doc.members?.name || "Unknown"}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          doc.status === "approved" ? "default" : 
                          doc.status === "pending" ? "secondary" : 
                          "destructive"
                        }
                      >
                        {doc.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(doc.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}