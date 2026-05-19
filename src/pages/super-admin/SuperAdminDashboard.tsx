import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3, Users, AlertTriangle, Lock, MessageSquare, Activity,
  Eye, RefreshCw, Search, Download, Filter, Loader2, TrendingUp,
  UserCheck, Calendar, Mail, Phone, MapPin, CreditCard
} from "lucide-react";
import { Link } from "react-router-dom";

export default function SuperAdminDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLevel, setFilterLevel] = useState("all");

  // Get all members with additional details for super admin
  const { data: members = [], isLoading: membersLoading, error: membersError } = useQuery({
    queryKey: ["all-members-super-admin"],
    queryFn: async () => {
      console.log("Fetching members for super admin...");
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("Error fetching members:", error);
        throw error;
      }
      
      console.log("Members fetched:", data?.length || 0);
      return data || [];
    },
  });

  // Get contributions data
  const { data: contributions = [] } = useQuery({
    queryKey: ["all-contributions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contributions")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Get payments data
  const { data: payments = [] } = useQuery({
    queryKey: ["all-payments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Get system logs
  const { data: systemLogs = [] } = useQuery({
    queryKey: ["system-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Get audit logs
  const { data: auditLogs = [] } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // Get member access logs
  const { data: memberAccessLogs = [] } = useQuery({
    queryKey: ["member-access-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("member_access_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.phone.includes(searchTerm) ||
    (m as any).email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate statistics
  const activeMembers = members.filter(m => m.is_active).length;
  const totalContributions = contributions.reduce((sum, c) => sum + (c.amount || 0), 0);
  const totalPayments = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const errorCount = systemLogs.filter(l => l.log_level === "ERROR").length;
  const recentMembers = members.filter(m => {
    const memberDate = new Date(m.created_at);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return memberDate > thirtyDaysAgo;
  }).length;

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl gradient-brand flex items-center justify-center shadow-brand">
                <BarChart3 className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="text-gradient-brand">Super Admin Dashboard</span>
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">Complete system oversight and member management</p>
          </div>
          <Badge className="self-start sm:self-auto text-sm px-3 py-1.5 glass-brand text-primary border-primary/30">
            Enhanced Access
          </Badge>
        </div>

        {/* Stats Cards Row â€” glassmorphism */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: "Total Members", value: members.length.toLocaleString(), icon: Users, sub: `${activeMembers} active`, accent: "from-primary/30 to-primary-glow/10" },
            { label: "Active Members", value: activeMembers.toLocaleString(), icon: UserCheck, sub: `${recentMembers} new this month`, accent: "from-success/30 to-success/5" },
            { label: "Contributions", value: `KES ${totalContributions.toLocaleString()}`, icon: TrendingUp, sub: `${contributions.length} txns`, accent: "from-primary/30 to-primary-glow/10" },
            { label: "System Health", value: errorCount === 0 ? "Healthy" : `${errorCount} Issues`, icon: Activity, sub: `${memberAccessLogs.length} access logs`, accent: "from-secondary/30 to-secondary/5" },
          ].map((s, i) => (
            <Card key={i} className="glass border-white/40 overflow-hidden relative group hover:shadow-glass-lg transition-all">
              <div className={`absolute inset-0 bg-gradient-to-br ${s.accent} opacity-60 pointer-events-none`} />
              <CardContent className="relative p-4 sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</p>
                    <div className="text-base sm:text-2xl font-bold mt-1.5 break-words leading-tight">{s.value}</div>
                  </div>
                  <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl glass-brand flex items-center justify-center shrink-0">
                    <s.icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                </div>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-3 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> {s.sub}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="members" className="space-y-6">
          <TabsList className="bg-muted">
            <TabsTrigger value="members">
              <Users className="h-4 w-4 mr-2" />
              Members
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="system">
              <AlertTriangle className="h-4 w-4 mr-2" />
              System
            </TabsTrigger>
            <TabsTrigger value="audit">
              <Eye className="h-4 w-4 mr-2" />
              Audit
            </TabsTrigger>
          </TabsList>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Member Management</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {membersError && (
                  <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                    <p className="text-destructive">
                      Error loading members: {membersError.message}
                    </p>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, phone, or email..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {membersLoading ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-muted-foreground">Loading members...</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {filteredMembers.length === 0 ? (
                      <div className="text-center py-12">
                        <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">
                          {members.length === 0 ? "No members found in database" : "No members match your search"}
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Total members in database: {members.length}
                        </p>
                      </div>
                    ) : (
                      filteredMembers.map(member => (
                        <Card key={member.id} className="glass border-white/40 hover:shadow-glass-lg transition-all overflow-hidden">
                          <CardContent className="p-3 sm:p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full gradient-brand flex items-center justify-center shrink-0 shadow-brand">
                                <span className="text-primary-foreground font-semibold text-sm sm:text-base">
                                  {member.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0 space-y-1.5">
                                <div className="flex items-start justify-between gap-2">
                                  <h3 className="font-semibold text-sm sm:text-base truncate">{member.name}</h3>
                                  <Link to={`/super-admin/member/${member.id}`} className="shrink-0">
                                    <Button size="sm" className="h-7 sm:h-8 px-2 sm:px-3 text-xs gradient-brand text-primary-foreground">
                                      <Eye className="h-3 w-3 sm:mr-1" />
                                      <span className="hidden sm:inline">Manage</span>
                                    </Button>
                                  </Link>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1 truncate max-w-full">
                                    <Phone className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{member.phone}</span>
                                  </span>
                                  {(member as any).email && (
                                    <span className="flex items-center gap-1 truncate max-w-full">
                                      <Mail className="h-3 w-3 shrink-0" />
                                      <span className="truncate">{(member as any).email}</span>
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  <Badge variant={member.is_active ? "default" : "secondary"} className="text-[10px] h-5">
                                    {member.is_active ? "Active" : "Inactive"}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px] h-5">
                                    ID: {(member as any).id_number || "N/A"}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px] h-5 glass-brand text-primary border-primary/30">
                                    <CreditCard className="h-2.5 w-2.5 mr-1" />
                                    KES {Number(member.total_contributions || 0).toLocaleString()}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px] h-5">
                                    <Calendar className="h-2.5 w-2.5 mr-1" />
                                    {new Date(member.created_at).toLocaleDateString()}
                                  </Badge>
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

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">Member Growth</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                      <p>Member growth chart would go here</p>
                      <p className="text-sm mt-2">Total: {members.length} members</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">Contribution Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <TrendingUp className="h-12 w-12 mx-auto mb-4" />
                      <p>Contribution trends chart would go here</p>
                      <p className="text-sm mt-2">Total: KES {totalContributions.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* System Tab */}
          <TabsContent value="system" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">System Logs & Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {systemLogs.length === 0 ? (
                    <div className="text-center py-12">
                      <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">No system logs found</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {systemLogs.slice(0, 10).map(log => (
                        <div key={log.id} className={`p-3 rounded-lg border ${
                          log.log_level === "ERROR" ? "bg-destructive/10 border-destructive/20" :
                          log.log_level === "WARNING" ? "bg-yellow-500/10 border-yellow-500/20" :
                          "bg-muted/50 border-border"
                        }`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant={log.log_level === "ERROR" ? "destructive" : "secondary"}>
                                  {log.log_level}
                                </Badge>
                                <span className="font-medium text-sm text-foreground">{log.component}</span>
                              </div>
                              <p className="text-sm mt-1 text-muted-foreground">{log.message}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(log.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Tab */}
          <TabsContent value="audit" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Access Logs & Audit Trail</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {memberAccessLogs.length === 0 ? (
                    <div className="text-center py-12">
                      <Eye className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">No access logs found</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {memberAccessLogs.slice(0, 10).map(log => (
                        <div key={log.id} className="p-3 bg-muted/50 border border-border rounded-lg">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-sm text-foreground">{log.access_type}</p>
                              {log.reason && (
                                <p className="text-xs text-muted-foreground mt-1">{log.reason}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(log.created_at).toLocaleString()}
                              </p>
                            </div>
                            <Badge variant="outline" className="">
                              {log.access_type}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
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
