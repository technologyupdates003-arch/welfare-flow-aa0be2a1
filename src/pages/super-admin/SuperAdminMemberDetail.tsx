import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  ArrowLeft, Lock, Eye, MessageSquare, Copy, RefreshCw, AlertCircle,
  CheckCircle, Loader2, Mail, Phone, Calendar, User, CreditCard, Shield,
  Activity, DollarSign, MapPin, Clock, Settings
} from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminMemberDetail() {
  const { memberId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [resetReason, setResetReason] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  // Get member details with all information
  const { data: member, isLoading: memberLoading, error: memberError } = useQuery({
    queryKey: ["member-detail-super-admin", memberId],
    queryFn: async () => {
      console.log("Fetching member details for ID:", memberId);
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .eq("id", memberId)
        .single();
      
      if (error) {
        console.error("Error fetching member:", error);
        throw error;
      }
      
      console.log("Member data:", data);
      return data;
    },
  });

  // Get member access logs
  const { data: accessLogs = [] } = useQuery({
    queryKey: ["member-access-logs", memberId],
    queryFn: async () => {
      const { data } = await supabase
        .from("member_access_logs")
        .select("*")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      if (!member?.user_id || !newPassword) {
        throw new Error("Password is required");
      }

      // Create password reset record
      const { error } = await supabase
        .from("password_resets")
        .insert({
          user_id: member.user_id,
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
          member_id: memberId,
          access_type: "reset_password",
          reason: resetReason,
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["password-resets"] });
      queryClient.invalidateQueries({ queryKey: ["member-access-logs"] });
      setResetDialogOpen(false);
      setNewPassword("");
      setResetReason("");
      toast.success("Password reset initiated. Member should receive new credentials.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Get member conversations and messages
  const { data: memberChats = [], isLoading: chatsLoading } = useQuery({
    queryKey: ["member-chats", memberId],
    queryFn: async () => {
      if (!member?.user_id) return [];
      
      // Get all conversations where this member is a participant
      const { data: participantData, error: participantError } = await supabase
        .from("conversation_participants")
        .select(`
          conversation_id,
          conversations (
            id,
            name,
            created_at,
            updated_at
          )
        `)
        .eq("user_id", member.user_id);

      if (participantError) {
        console.error("Error fetching conversations:", participantError);
        return [];
      }

      if (!participantData || participantData.length === 0) return [];

      // Get messages for each conversation
      const conversationsWithMessages = await Promise.all(
        participantData.map(async (p: any) => {
          const { data: messages, error: messagesError } = await supabase
            .from("messages")
            .select(`
              id,
              content,
              user_id,
              conversation_id,
              created_at,
              members (name)
            `)
            .eq("conversation_id", p.conversation_id)
            .order("created_at", { ascending: false })
            .limit(50);

          if (messagesError) {
            console.error("Error fetching messages:", messagesError);
          }

          return {
            ...p.conversations,
            messages: messages || []
          };
        })
      );

      return conversationsWithMessages.filter(c => c.id); // Filter out any null conversations
    },
    enabled: !!member?.user_id,
  });

  if (memberLoading) {
    return (
      <div className="space-y-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-muted-foreground">Loading member details...</p>
        </div>
      </div>
    );
  }

  if (memberError) {
    return (
      <div className="space-y-6 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <p className="text-red-400 mb-4 text-lg">Error loading member: {memberError.message}</p>
          <Button onClick={() => navigate("/super-admin")} className="">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="space-y-6 flex items-center justify-center">
        <div className="text-center">
          <User className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4 text-lg">Member not found (ID: {memberId})</p>
          <Button onClick={() => navigate("/super-admin")} className="">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/super-admin")}
              className="bg-card border border-border text-foreground hover:bg-slate-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-foreground font-bold text-xl">
                  {member.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-bold">{member.name}</h1>
                <p className="text-muted-foreground flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {member.phone}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge 
              variant={member.is_active ? "default" : "secondary"} 
              className={`text-base px-4 py-2 ${
                member.is_active 
                  ? "bg-gradient-to-r from-green-500 to-green-600" 
                  : "bg-gradient-to-r from-gray-500 to-gray-600"
              }`}
            >
              {member.is_active ? "Active Member" : "Inactive Member"}
            </Badge>
            <Badge variant="destructive" className="text-base px-4 py-2 bg-gradient-to-r from-red-500 to-pink-600">
              <Shield className="h-4 w-4 mr-2" />
              Super Admin View
            </Badge>
          </div>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-blue-600 to-blue-700 border-0 text-foreground">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium text-blue-100">Member ID</CardTitle>
                  <div className="text-lg font-bold mt-1">{(member as any).id_number || "N/A"}</div>
                </div>
                <User className="h-8 w-8 text-foreground/70" />
              </div>
            </CardHeader>
          </Card>

          <Card className="bg-gradient-to-br from-green-600 to-green-700 border-0 text-foreground">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium text-green-100">Total Contributions</CardTitle>
                  <div className="text-lg font-bold mt-1">KES {member.total_contributions?.toLocaleString() || "0"}</div>
                </div>
                <DollarSign className="h-8 w-8 text-foreground/70" />
              </div>
            </CardHeader>
          </Card>

          <Card className="bg-gradient-to-br from-orange-600 to-orange-700 border-0 text-foreground">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium text-orange-100">Member Since</CardTitle>
                  <div className="text-lg font-bold mt-1">
                    {new Date(member.created_at).toLocaleDateString()}
                  </div>
                </div>
                <Calendar className="h-8 w-8 text-foreground/70" />
              </div>
            </CardHeader>
          </Card>

          <Card className="bg-gradient-to-br from-purple-600 to-purple-700 border-0 text-foreground">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium text-purple-100">Account Status</CardTitle>
                  <div className="text-lg font-bold mt-1">{member.is_active ? "Active" : "Inactive"}</div>
                </div>
                <Activity className="h-8 w-8 text-foreground/70" />
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="profile" className="data-[state=active]:bg-blue-600 data-[state=active]:text-foreground">
              <User className="h-4 w-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="account" className="data-[state=active]:bg-blue-600 data-[state=active]:text-foreground">
              <Settings className="h-4 w-4 mr-2" />
              Account
            </TabsTrigger>
            <TabsTrigger value="password" className="data-[state=active]:bg-blue-600 data-[state=active]:text-foreground">
              <Lock className="h-4 w-4 mr-2" />
              Password
            </TabsTrigger>
            <TabsTrigger value="chats" className="data-[state=active]:bg-blue-600 data-[state=active]:text-foreground">
              <MessageSquare className="h-4 w-4 mr-2" />
              Chats
            </TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-blue-600 data-[state=active]:text-foreground">
              <Eye className="h-4 w-4 mr-2" />
              Logs
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Member Profile Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-muted/50 rounded-lg border border-border">
                      <Label className="text-muted-foreground text-sm">Full Name</Label>
                      <p className="font-semibold text-foreground text-lg mt-1">{member.name}</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg border border-border">
                      <Label className="text-muted-foreground text-sm">Phone Number</Label>
                      <p className="font-semibold text-foreground text-lg mt-1 flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {member.phone}
                      </p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg border border-border">
                      <Label className="text-muted-foreground text-sm">Email Address</Label>
                      <p className="font-semibold text-foreground text-lg mt-1 flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {(member as any).email || "Not provided"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="p-4 bg-muted/50 rounded-lg border border-border">
                      <Label className="text-muted-foreground text-sm">ID Number</Label>
                      <p className="font-semibold text-foreground text-lg mt-1">{(member as any).id_number || "Not provided"}</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg border border-border">
                      <Label className="text-muted-foreground text-sm">Account Status</Label>
                      <div className="mt-2">
                        <Badge variant={member.is_active ? "default" : "secondary"} className="text-sm px-3 py-1">
                          {member.is_active ? "Active Member" : "Inactive Member"}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg border border-border">
                      <Label className="text-muted-foreground text-sm">Total Contributions</Label>
                      <p className="font-semibold text-green-400 text-lg mt-1 flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        KES {member.total_contributions?.toLocaleString() || "0"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 bg-muted/50 rounded-lg border border-border">
                    <Label className="text-muted-foreground text-sm">Member Since</Label>
                    <p className="font-semibold text-foreground text-lg mt-1 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {new Date(member.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg border border-border">
                    <Label className="text-muted-foreground text-sm">Last Updated</Label>
                    <p className="font-semibold text-foreground text-lg mt-1 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {new Date(member.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {(member as any).address && (
                  <div className="p-4 bg-muted/50 rounded-lg border border-border">
                    <Label className="text-muted-foreground text-sm">Address</Label>
                    <p className="font-semibold text-foreground text-lg mt-1 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {(member as any).address}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 bg-muted/50 rounded-lg border border-border">
                    <Label className="text-muted-foreground text-sm">User ID</Label>
                    <p className="font-mono text-sm text-foreground bg-muted/30 p-2 rounded mt-1">{member.user_id}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg border border-border">
                    <Label className="text-muted-foreground text-sm">Member ID</Label>
                    <p className="font-mono text-sm text-foreground bg-muted/30 p-2 rounded mt-1">{member.id}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Password Tab */}
          <TabsContent value="password" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Password Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-yellow-900/30 rounded-lg border border-yellow-700/50 flex gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-200">
                    <p className="font-semibold">Password Reset</p>
                    <p>Generate a new temporary password for this member. They will receive it via email.</p>
                  </div>
                </div>

                <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full ">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reset Password
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-slate-800 border-border">
                    <DialogHeader>
                      <DialogTitle className="text-foreground">Reset Member Password</DialogTitle>
                      <DialogDescription className="text-muted-foreground">
                        Generate a new password for {member.name}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-foreground">New Password</Label>
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                          className="bg-muted border-border text-foreground"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowPassword(!showPassword)}
                          className="mt-2 text-muted-foreground"
                        >
                          {showPassword ? "Hide" : "Show"}
                        </Button>
                      </div>
                      <div>
                        <Label className="text-foreground">Reason for Reset</Label>
                        <Textarea
                          value={resetReason}
                          onChange={e => setResetReason(e.target.value)}
                          placeholder="Why is this password being reset?"
                          rows={3}
                          className="bg-muted border-border text-foreground"
                        />
                      </div>
                      <Button
                        onClick={() => resetPasswordMutation.mutate()}
                        disabled={resetPasswordMutation.isPending || !newPassword}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        {resetPasswordMutation.isPending ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Resetting...</>
                        ) : (
                          "Reset Password"
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Chats Tab */}
          <TabsContent value="chats" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Member Conversations & Messages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-blue-900/30 rounded-lg border border-blue-700/50 flex gap-3 mb-6">
                  <Eye className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-200">
                    <p className="font-semibold">Viewing Member Chats</p>
                    <p>All chat access is logged for security and compliance.</p>
                  </div>
                </div>

                {chatsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : memberChats.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No conversations found for this member</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {memberChats.map((chat: any) => (
                      <Card key={chat.id} className="bg-muted/50">
                        <CardHeader>
                          <CardTitle className="text-base flex items-center justify-between">
                            <span>{chat.name || "Unnamed Conversation"}</span>
                            <Badge variant="outline">
                              {chat.messages?.length || 0} messages
                            </Badge>
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            Created: {new Date(chat.created_at).toLocaleDateString()}
                          </p>
                        </CardHeader>
                        <CardContent>
                          {chat.messages && chat.messages.length > 0 ? (
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                              {chat.messages.map((msg: any) => (
                                <div
                                  key={msg.id}
                                  className={`p-3 rounded-lg ${
                                    msg.user_id === member?.user_id
                                      ? "bg-blue-900/30 border border-blue-700/50"
                                      : "bg-muted"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium">
                                      {msg.members?.name || "Unknown User"}
                                      {msg.user_id === member?.user_id && (
                                        <Badge variant="outline" className="ml-2 text-xs">
                                          This Member
                                        </Badge>
                                      )}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(msg.created_at).toLocaleString()}
                                    </span>
                                  </div>
                                  <p className="text-sm">{msg.content}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No messages in this conversation
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Access Logs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                {accessLogs.length === 0 ? (
                  <div className="text-center py-12">
                    <Eye className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No access logs found</p>
                  </div>
                ) : (
                  accessLogs.map(log => (
                    <Card key={log.id} className="bg-muted/50 border-border">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-foreground text-sm">{log.access_type}</p>
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
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}