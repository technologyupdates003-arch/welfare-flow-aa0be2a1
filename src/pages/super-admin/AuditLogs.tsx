import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Database, Eye, Download, Search, Filter, Loader2, Calendar,
  User, Activity, Shield, MessageSquare, Lock, Radio, Wifi, Clock
} from "lucide-react";
import { useOnlineMembers } from "@/hooks/useOnlineMembers";

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AuditLogs() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const { online, onlineCount, onlineMemberCount, loading: presenceLoading } = useOnlineMembers();

  // Realtime: refresh logs the moment new rows arrive
  useEffect(() => {
    const channel = supabase
      .channel("audit-logs-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_logs" }, () =>
        queryClient.invalidateQueries({ queryKey: ["audit-logs-full"] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "member_access_logs" }, () =>
        queryClient.invalidateQueries({ queryKey: ["member-access-logs-full"] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "system_logs" }, () =>
        queryClient.invalidateQueries({ queryKey: ["system-logs-audit"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Only ever load a recent, bounded window of logs. Tables can hold millions
  // of rows — we never select without a time filter AND a row limit.
  const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const PAGE_SIZE = 100;

  // Get audit logs
  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ["audit-logs-full", sinceIso.slice(0, 10)],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      return data || [];
    },
    staleTime: 20000,
    refetchInterval: 60000,
  });

  // Get member access logs
  const { data: memberAccessLogs = [] } = useQuery({
    queryKey: ["member-access-logs-full", sinceIso.slice(0, 10)],
    queryFn: async () => {
      const { data } = await supabase
        .from("member_access_logs")
        .select("*")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      return data || [];
    },
    staleTime: 20000,
    refetchInterval: 60000,
  });

  // Get system logs
  const { data: systemLogs = [] } = useQuery({
    queryKey: ["system-logs-audit", sinceIso.slice(0, 10)],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_logs")
        .select("*")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      return data || [];
    },
    staleTime: 20000,
    refetchInterval: 60000,
  });

  const filteredAccessLogs = memberAccessLogs.filter(log =>
    log.access_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.reason?.toLowerCase().includes(searchTerm.toLowerCase())
  );


  const exportLogs = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Type,Action,Timestamp,Details\n" +
      memberAccessLogs.map(log => 
        `${log.access_type},${log.reason || "N/A"},${new Date(log.created_at).toLocaleString()},${log.member_id}`
      ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `audit_logs_${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                <Database className="h-7 w-7 text-foreground" />
              </div>
              Audit Logs
            </h1>
            <p className="text-muted-foreground mt-2">Complete system audit trail and activity logs</p>
          </div>
          <Button onClick={exportLogs} className="">
            <Download className="h-4 w-4 mr-2" />
            Export Logs
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
          <Card className="bg-gradient-to-br from-emerald-600 to-emerald-700 border-0 text-foreground relative overflow-hidden">
            <span className="absolute top-3 right-3 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/70 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
            </span>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium text-emerald-100 flex items-center gap-1">
                    <Radio className="h-3.5 w-3.5" /> Live Online Now
                  </CardTitle>
                  <div className="text-3xl font-bold mt-2">
                    {presenceLoading ? "…" : onlineCount}
                  </div>
                  <p className="text-[11px] text-emerald-100/90 mt-1">{onlineMemberCount} members</p>
                </div>
                <Wifi className="h-8 w-8 text-foreground/70" />
              </div>
            </CardHeader>
          </Card>

          <Card className="bg-gradient-to-br from-blue-600 to-blue-700 border-0 text-foreground">

            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium text-blue-100">Total Access Logs</CardTitle>
                  <div className="text-3xl font-bold mt-2">{memberAccessLogs.length}</div>
                </div>
                <Eye className="h-8 w-8 text-foreground/70" />
              </div>
            </CardHeader>
          </Card>

          <Card className="bg-gradient-to-br from-green-600 to-green-700 border-0 text-foreground">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium text-green-100">System Logs</CardTitle>
                  <div className="text-3xl font-bold mt-2">{systemLogs.length}</div>
                </div>
                <Activity className="h-8 w-8 text-foreground/70" />
              </div>
            </CardHeader>
          </Card>

          <Card className="bg-gradient-to-br from-orange-600 to-orange-700 border-0 text-foreground">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium text-orange-100">Audit Entries</CardTitle>
                  <div className="text-3xl font-bold mt-2">{auditLogs.length}</div>
                </div>
                <Shield className="h-8 w-8 text-foreground/70" />
              </div>
            </CardHeader>
          </Card>

          <Card className="bg-gradient-to-br from-purple-600 to-purple-700 border-0 text-foreground">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium text-purple-100">Today's Activity</CardTitle>
                  <div className="text-3xl font-bold mt-2">
                    {memberAccessLogs.filter(log => {
                      const logDate = new Date(log.created_at);
                      const today = new Date();
                      return logDate.toDateString() === today.toDateString();
                    }).length}
                  </div>
                </div>
                <Calendar className="h-8 w-8 text-foreground/70" />
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="live" className="space-y-6">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="live" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-foreground">
              <Radio className="h-4 w-4 mr-2" />
              Live Sessions
            </TabsTrigger>
            <TabsTrigger value="access" className="data-[state=active]:bg-purple-600 data-[state=active]:text-foreground">
              <Eye className="h-4 w-4 mr-2" />
              Access Logs
            </TabsTrigger>

            <TabsTrigger value="system" className="data-[state=active]:bg-purple-600 data-[state=active]:text-foreground">
              <Activity className="h-4 w-4 mr-2" />
              System Logs
            </TabsTrigger>
            <TabsTrigger value="audit" className="data-[state=active]:bg-purple-600 data-[state=active]:text-foreground">
              <Shield className="h-4 w-4 mr-2" />
              Audit Trail
            </TabsTrigger>
          </TabsList>

          {/* Live Sessions Tab */}
          <TabsContent value="live" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                    Currently Online ({onlineCount})
                  </CardTitle>
                  <Badge variant="outline" className="border-emerald-600 text-emerald-500">Realtime</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {presenceLoading ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-emerald-500" />
                    <p className="text-muted-foreground">Loading live sessions...</p>
                  </div>
                ) : online.length === 0 ? (
                  <div className="text-center py-12">
                    <Wifi className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No members are online right now</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[28rem] overflow-y-auto">
                    {online.map(u => (
                      <Card key={u.user_id} className="bg-muted/50 border-border">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="relative flex h-3 w-3 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                              </span>
                              <div className="min-w-0">
                                <p className="font-medium text-foreground text-sm truncate">
                                  {u.name || "Unknown user"}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">{u.phone || u.user_id}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {(u.roles.length ? u.roles : ["member"]).map(r => (
                                <Badge key={r} variant="outline" className="border-purple-600 text-purple-400 capitalize">
                                  {r.replace("_", " ")}
                                </Badge>
                              ))}
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {timeAgo(u.last_seen)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Access Logs Tab */}

          <TabsContent value="access" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground">Member Access Logs</CardTitle>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search logs..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-10 "
                      />
                    </div>
                    <Button variant="outline" size="sm" className="">
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
                    <p className="text-muted-foreground">Loading logs...</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredAccessLogs.length === 0 ? (
                      <div className="text-center py-12">
                        <Eye className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No access logs found</p>
                      </div>
                    ) : (
                      filteredAccessLogs.map(log => (
                        <Card key={log.id} className="bg-muted/50 border-border">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="border-purple-600 text-purple-300">
                                    {log.access_type}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(log.created_at).toLocaleString()}
                                  </span>
                                </div>
                                {log.reason && (
                                  <p className="text-sm text-muted-foreground mb-1">{log.reason}</p>
                                )}
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    Member: {log.member_id}
                                  </span>
                                  {log.super_admin_id && (
                                    <span className="flex items-center gap-1">
                                      <Shield className="h-3 w-3" />
                                      Admin: {log.super_admin_id}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Logs Tab */}
          <TabsContent value="system" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">System Activity Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {systemLogs.length === 0 ? (
                    <div className="text-center py-12">
                      <Activity className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No system logs found</p>
                    </div>
                  ) : (
                    systemLogs.map(log => (
                      <Card key={log.id} className={`border-0 ${
                        log.log_level === "ERROR" ? "bg-red-900/30" :
                        log.log_level === "WARNING" ? "bg-yellow-900/30" :
                        "bg-muted/50"
                      }`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant={log.log_level === "ERROR" ? "destructive" : "secondary"}>
                                  {log.log_level}
                                </Badge>
                                <span className="font-medium text-foreground text-sm">{log.component}</span>
                              </div>
                              <p className="text-sm text-muted-foreground mb-1">{log.message}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(log.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Trail Tab */}
          <TabsContent value="audit" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Complete Audit Trail</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {auditLogs.length === 0 ? (
                    <div className="text-center py-12">
                      <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No audit entries found</p>
                    </div>
                  ) : (
                    auditLogs.map(log => (
                      <Card key={log.id} className="bg-muted/50 border-border">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="border-blue-600 text-blue-300">
                                  Audit Entry
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(log.created_at).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">Audit log entry #{log.id}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
