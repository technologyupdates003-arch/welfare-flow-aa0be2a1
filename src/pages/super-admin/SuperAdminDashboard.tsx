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
  DollarSign, UserCheck, Calendar, Mail, Phone, MapPin, CreditCard
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <BarChart3 className="h-7 w-7 text-foreground" />
              </div>
              Super Admin Dashboard
            </h1>
            <p className="text-muted-foreground mt-2">Complete system oversight and member management</p>
          </div>
          <Badge variant="destructive" className="text-base px-4 py-2 bg-gradient-to-r from-red-500 to-pink-600">
            Enhanced Access
          </Badge>
        </div>

        {/* Stats Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Members Card */}
          <Card className="bg-gradient-to-br from-blue-600 to-blue-700 border-0 text-foreground">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium text-blue-100">Total Members</CardTitle>
                  <div className="text-3xl font-bold mt-2">{members.length.toLocaleString()}</div>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <Users className="h-6 w-6 text-foreground" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-blue-100">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">{activeMembers} active members</span>
              </div>
            </CardContent>
          </Card>

          {/* Active Members Card */}
          <Card className="bg-gradient-to-br from-green-600 to-green-700 border-0 text-foreground">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium text-green-100">Active Members</CardTitle>
                  <div className="text-3xl font-bold mt-2">{activeMembers.toLocaleString()}</div>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <UserCheck className="h-6 w-6 text-foreground" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-green-100">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">{recentMembers} new this month</span>
              </div>
            </CardContent>
          </Card>

          {/* Total Contributions Card */}
          <Card className="bg-gradient-to-br from-orange-600 to-orange-700 border-0 text-foreground">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium text-orange-100">Total Contributions</CardTitle>
                  <div className="text-3xl font-bold mt-2">KES {totalContributions.toLocaleString()}</div>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-foreground" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-orange-100">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">{contributions.length} transactions</span>
              </div>
            </CardContent>
          </Card>

          {/* System Health Card */}
          <Card className="bg-gradient-to-br from-purple-600 to-purple-700 border-0 text-foreground">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium text-purple-100">System Health</CardTitle>
                  <div className="text-3xl font-bold mt-2">{errorCount === 0 ? "Healthy" : `${errorCount} Issues`}</div>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <Activity className="h-6 w-6 text-foreground" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-purple-100">
                <Activity className="h-4 w-4" />
                <span className="text-sm">{memberAccessLogs.length} access logs</span>
              </div>
            </CardContent>
          </Card>
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
                        <Card key={member.id} className="hover:bg-muted/50 transition-colors">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                                  <span className="text-foreground font-semibold">
                                    {member.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div className="flex-1">
                                  <h3 className="font-semibold">{member.name}</h3>
                                  <div className="flex items-center gap-4 mt-1">
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <Phone className="h-3 w-3" />
                                      <span className="text-sm">{member.phone}</span>
                                    </div>
                                    {(member as any).email && (
                                      <div className="flex items-center gap-1 text-muted-foreground">
                                        <Mail className="h-3 w-3" />
                                        <span className="text-sm">{(member as any).email}</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex gap-2 mt-2">
                                    <Badge variant={member.is_active ? "default" : "secondary"} className="text-xs">
                                      {member.is_active ? "Active" : "Inactive"}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      ID: {(member as any).id_number || "N/A"}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right text-sm text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <CreditCard className="h-3 w-3" />
                                    <span>KES {member.total_contributions?.toLocaleString() || "0"}</span>
                                  </div>
                                  <div className="flex items-center gap-1 mt-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>{new Date(member.created_at).toLocaleDateString()}</span>
                                  </div>
                                </div>
                                <Link to={`/super-admin/member/${member.id}`}>
                                  <Button size="sm">
                                    <Eye className="h-4 w-4 mr-1" />
                                    Manage
                                  </Button>
                                </Link>
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
                      <DollarSign className="h-12 w-12 mx-auto mb-4" />
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