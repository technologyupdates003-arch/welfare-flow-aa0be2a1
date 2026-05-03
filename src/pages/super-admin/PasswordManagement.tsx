import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Key, RefreshCw, Search, Loader2, User, Calendar, Shield,
  AlertTriangle, CheckCircle, Eye, EyeOff
} from "lucide-react";
import { toast } from "sonner";

export default function PasswordManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetReason, setResetReason] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  // Get all members
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members-password-management"],
    queryFn: async () => {
      const { data } = await supabase
        .from("members")
        .select("*")
        .order("name", { ascending: true });
      return data || [];
    },
  });

  // Get password reset history
  const { data: resetHistory = [] } = useQuery({
    queryKey: ["password-reset-history"],
    queryFn: async () => {
      const { data } = await supabase
        .from("password_resets")
        .select("*")
        .order("reset_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMember?.user_id || !newPassword) {
        throw new Error("Password is required");
      }

      // Create password reset record
      const { error } = await supabase
        .from("password_resets")
        .insert({
          user_id: selectedMember.user_id,
          reset_token: `reset_${Date.now()}`,
          reset_by: user?.id,
          new_password_hash: newPassword,
          reset_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Log the access
      await supabase
        .from("member_access_logs")
        .insert({
          super_admin_id: user?.id,
          member_id: selectedMember.id,
          access_type: "reset_password",
          reason: resetReason,
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["password-reset-history"] });
      queryClient.invalidateQueries({ queryKey: ["member-access-logs"] });
      setResetDialogOpen(false);
      setSelectedMember(null);
      setNewPassword("");
      setResetReason("");
      toast.success("Password reset successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Generate random password
  const generatePassword = () => {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setNewPassword(password);
  };

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.phone.includes(searchTerm) ||
    (m as any).email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                <Key className="h-7 w-7 text-foreground" />
              </div>
              Password Management
            </h1>
            <p className="text-muted-foreground mt-2">Manage user passwords and reset credentials</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-blue-600 to-blue-700 border-0 text-foreground">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium text-blue-100">Total Users</CardTitle>
                  <div className="text-3xl font-bold mt-2">{members.length}</div>
                </div>
                <User className="h-8 w-8 text-foreground/70" />
              </div>
            </CardHeader>
          </Card>

          <Card className="bg-gradient-to-br from-green-600 to-green-700 border-0 text-foreground">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium text-green-100">Resets Today</CardTitle>
                  <div className="text-3xl font-bold mt-2">
                    {resetHistory.filter(r => {
                      const resetDate = new Date(r.reset_at);
                      const today = new Date();
                      return resetDate.toDateString() === today.toDateString();
                    }).length}
                  </div>
                </div>
                <RefreshCw className="h-8 w-8 text-foreground/70" />
              </div>
            </CardHeader>
          </Card>

          <Card className="bg-gradient-to-br from-orange-600 to-orange-700 border-0 text-foreground">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium text-orange-100">Total Resets</CardTitle>
                  <div className="text-3xl font-bold mt-2">{resetHistory.length}</div>
                </div>
                <Calendar className="h-8 w-8 text-foreground/70" />
              </div>
            </CardHeader>
          </Card>

          <Card className="bg-gradient-to-br from-purple-600 to-purple-700 border-0 text-foreground">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium text-purple-100">Active Users</CardTitle>
                  <div className="text-3xl font-bold mt-2">{members.filter(m => m.is_active).length}</div>
                </div>
                <CheckCircle className="h-8 w-8 text-foreground/70" />
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="users" className="data-[state=active]:bg-green-600 data-[state=active]:text-foreground">
              <User className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-green-600 data-[state=active]:text-foreground">
              <Calendar className="h-4 w-4 mr-2" />
              Reset History
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground">User Password Management</CardTitle>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-10 "
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
                    <p className="text-muted-foreground">Loading users...</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {filteredMembers.length === 0 ? (
                      <div className="text-center py-12">
                        <User className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No users found</p>
                      </div>
                    ) : (
                      filteredMembers.map(member => (
                        <Card key={member.id} className="bg-muted/50 border-border hover:bg-muted transition-colors">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                                  <span className="text-foreground font-semibold">
                                    {member.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <h3 className="font-semibold text-foreground">{member.name}</h3>
                                  <p className="text-sm text-muted-foreground">{member.phone}</p>
                                  {(member as any).email && (
                                    <p className="text-xs text-muted-foreground">{(member as any).email}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={member.is_active ? "default" : "secondary"}>
                                  {member.is_active ? "Active" : "Inactive"}
                                </Badge>
                                <Dialog open={resetDialogOpen && selectedMember?.id === member.id} onOpenChange={setResetDialogOpen}>
                                  <DialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      className="bg-green-600 hover:bg-green-700"
                                      onClick={() => setSelectedMember(member)}
                                    >
                                      <RefreshCw className="h-4 w-4 mr-1" />
                                      Reset Password
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="bg-slate-800 border-border">
                                    <DialogHeader>
                                      <DialogTitle className="text-foreground">Reset Password</DialogTitle>
                                      <DialogDescription className="text-muted-foreground">
                                        Generate a new password for {selectedMember?.name}
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div className="p-4 bg-yellow-900/30 rounded-lg border border-yellow-700/50 flex gap-3">
                                        <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                                        <div className="text-sm text-yellow-200">
                                          <p className="font-semibold">Security Notice</p>
                                          <p>This action will be logged for security audit purposes</p>
                                        </div>
                                      </div>

                                      <div>
                                        <Label className="text-foreground">New Password</Label>
                                        <div className="flex gap-2 mt-2">
                                          <Input
                                            type={showPassword ? "text" : "password"}
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            placeholder="Enter new password"
                                            className="bg-muted border-border text-foreground"
                                          />
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="border-border"
                                          >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                          </Button>
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={generatePassword}
                                          className="mt-2 text-blue-400 hover:text-blue-300"
                                        >
                                          <RefreshCw className="h-3 w-3 mr-1" />
                                          Generate Random Password
                                        </Button>
                                      </div>

                                      <div>
                                        <Label className="text-foreground">Reason for Reset</Label>
                                        <Textarea
                                          value={resetReason}
                                          onChange={e => setResetReason(e.target.value)}
                                          placeholder="Why is this password being reset?"
                                          rows={3}
                                          className="bg-muted border-border text-foreground mt-2"
                                        />
                                      </div>

                                      <Button
                                        onClick={() => resetPasswordMutation.mutate()}
                                        disabled={resetPasswordMutation.isPending || !newPassword || !resetReason}
                                        className="w-full bg-green-600 hover:bg-green-700"
                                      >
                                        {resetPasswordMutation.isPending ? (
                                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Resetting...</>
                                        ) : (
                                          <><CheckCircle className="h-4 w-4 mr-2" /> Reset Password</>
                                        )}
                                      </Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>
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

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Password Reset History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {resetHistory.length === 0 ? (
                    <div className="text-center py-12">
                      <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No password resets found</p>
                    </div>
                  ) : (
                    resetHistory.map(reset => (
                      <Card key={reset.id} className="bg-muted/50 border-border">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="border-green-600 text-green-300">
                                  Password Reset
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(reset.reset_at).toLocaleString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  User: {reset.user_id}
                                </span>
                                {reset.reset_by && (
                                  <span className="flex items-center gap-1">
                                    <Shield className="h-3 w-3" />
                                    Reset by: {reset.reset_by}
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
