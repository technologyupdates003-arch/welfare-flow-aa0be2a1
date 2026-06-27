import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getRoleLabel, getRoleColor, ROLE_CONFIG } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Loader2, Trash2, Edit, Users, Shield, Eye } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Members() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [beneficiariesOpen, setBeneficiariesOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [form, setForm] = useState({ name: "", phone: "", member_id: "", role: "" });
  const [editForm, setEditForm] = useState({ name: "", phone: "", member_id: "", role: "" });
  const [beneficiaryForm, setBeneficiaryForm] = useState({ name: "", relationship: "", phone: "", id_number: "" });

  const { data: members, isLoading } = useQuery({
    queryKey: ["members", search],
    queryFn: async () => {
      let q = supabase.from("members").select("*").order("name");
      if (search) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%,member_id.ilike.%${search}%`);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: membersWithRoles, refetch: refetchMembersWithRoles } = useQuery({
    queryKey: ["members-with-roles"],
    queryFn: async () => {
      // Get all members
      const { data: membersData, error: membersError } = await supabase
        .from("members")
        .select("id, name, phone, user_id")
        .order("name");
      
      if (membersError) {
        console.error("Error fetching members:", membersError);
        throw membersError;
      }

      // Get all roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");
      
      if (rolesError) {
        console.error("Error fetching roles:", rolesError);
        throw rolesError;
      }

      // Create a map of user_id -> role
      const roleMap = new Map(rolesData?.map(r => [r.user_id, r.role]) || []);

      // Combine members with their roles
      return (membersData || []).map(member => ({
        ...member,
        user_roles: member.user_id && roleMap?.has(member.user_id) 
          ? [{ role: roleMap?.get(member.user_id) }]
          : []
      }));
    },
  });

  // Subscribe to real-time role changes
  useEffect(() => {
    const subscription = supabase
      .channel("user_roles_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_roles",
        },
        () => {
          refetchMembersWithRoles();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [refetchMembersWithRoles]);

  const { data: beneficiaries, isLoading: beneficiariesLoading } = useQuery({
    queryKey: ["beneficiaries", selectedMember?.id],
    queryFn: async () => {
      if (!selectedMember?.id) return [];
      const { data } = await supabase
        .from("beneficiaries")
        .select("*")
        .eq("member_id", selectedMember.id)
        .order("name");
      return data || [];
    },
    enabled: !!selectedMember?.id,
  });

  const addMember = useMutation({
    mutationFn: async () => {
      const phone = form.phone.startsWith("+254") ? form.phone : `+254${form.phone.replace(/^0/, "")}`;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/create-member`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password: "Member2026", name: form.name, member_id: form.member_id }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to create member");
      
      if (form.role && form.role !== "none" && data.user_id) {
        await supabase.from("user_roles").delete().eq("user_id", data.user_id);
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({ user_id: data.user_id, role: form.role as any });
        if (roleError) throw new Error(`Failed to assign role: ${roleError.message}`);
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["members-with-roles"] });
      setOpen(false);
      setForm({ name: "", phone: "", member_id: "", role: "" });
      toast.success("Member added! They can login with phone and password: Member2026");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMember = useMutation({
    mutationFn: async () => {
      const phone = editForm.phone.startsWith("+254") ? editForm.phone : `+254${editForm.phone.replace(/^0/, "")}`;
      const { error } = await supabase
        .from("members")
        .update({
          name: editForm.name,
          phone: phone,
          member_id: editForm.member_id || null,
        })
        .eq("id", selectedMember.id);
      if (error) throw new Error(error.message);
      
      const { data: member } = await supabase
        .from("members")
        .select("user_id")
        .eq("id", selectedMember.id)
        .single();
      
      if (member?.user_id) {
        if (editForm.role && editForm.role !== "none") {
          const { error: roleError } = await supabase
            .from("user_roles")
            .upsert({ user_id: member.user_id, role: editForm.role as any });
          if (roleError) throw new Error(`Failed to assign role: ${roleError.message}`);
        } else if (editForm.role === "none") {
          const { error: roleError } = await supabase
            .from("user_roles")
            .delete()
            .eq("user_id", member.user_id);
          if (roleError) throw new Error(`Failed to remove role: ${roleError.message}`);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["members-with-roles"] });
      setEditOpen(false);
      setSelectedMember(null);
      toast.success("Member updated successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addBeneficiary = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("beneficiaries").insert({
        member_id: selectedMember.id,
        name: beneficiaryForm.name,
        relationship: beneficiaryForm.relationship,
        phone: beneficiaryForm.phone || null,
        id_number: beneficiaryForm.id_number || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["beneficiaries"] });
      setBeneficiaryForm({ name: "", relationship: "", phone: "", id_number: "" });
      toast.success("Beneficiary added successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteBeneficiary = useMutation({
    mutationFn: async (beneficiaryId: string) => {
      const { error } = await supabase.from("beneficiaries").delete().eq("id", beneficiaryId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["beneficiaries"] });
      toast.success("Beneficiary removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from("members").delete().eq("id", memberId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Member deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignRole = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const { data: member } = await supabase
        .from("members")
        .select("user_id")
        .eq("id", memberId)
        .single();
      
      if (!member?.user_id) {
        throw new Error("Member must have a user account to assign roles.");
      }

      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", member.user_id);
      
      if (deleteError) throw new Error(`Failed to remove old role: ${deleteError.message}`);

      const { error: insertError } = await supabase
        .from("user_roles")
        .insert({ user_id: member.user_id, role: role as any });
      
      if (insertError) throw new Error(`Failed to assign role: ${insertError.message}`);
      
      return { memberId, role };
    },
    onSuccess: async (data) => {
      // Force immediate refetch
      await refetchMembersWithRoles();
      
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["members-with-roles"] });
      setRoleDialogOpen(false);
      setSelectedMember(null);
      setSelectedRole("");
      toast.success("Role assigned successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeRole = useMutation({
    mutationFn: async (memberId: string) => {
      const { data: member } = await supabase
        .from("members")
        .select("user_id")
        .eq("id", memberId)
        .single();
      
      if (!member?.user_id) throw new Error("Member not found");

      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", member.user_id);
      
      if (error) throw new Error(`Failed to remove role: ${error.message}`);
      
      return memberId;
    },
    onSuccess: async () => {
      // Force immediate refetch
      await refetchMembersWithRoles();
      
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["members-with-roles"] });
      setRoleDialogOpen(false);
      setSelectedMember(null);
      toast.success("Role removed successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleAssignRole = (member: any) => {
    setSelectedMember(member);
    setSelectedRole("");
    setRoleDialogOpen(true);
  };

  const getMemberRole = (memberId: string) => {
    const memberWithRole = membersWithRoles?.find(m => m.id === memberId);
    const userRoles = memberWithRole?.user_roles;
    
    if (Array.isArray(userRoles) && userRoles.length > 0) {
      return userRoles[0]?.role || null;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search members..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={async () => {
              console.log("Refresh clicked");
              await refetchMembersWithRoles();
              queryClient.invalidateQueries({ queryKey: ["members-with-roles"] });
              toast.success("Roles refreshed");
            }}
          >
            Refresh
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Add Member</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Member</DialogTitle>
                <DialogDescription>Create a member account with universal password: Member2026</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" /></div>
                <div><Label>ID Number</Label><Input value={form.member_id} onChange={e => setForm(f => ({ ...f, member_id: e.target.value }))} placeholder="e.g. 32580859" /></div>
                <div><Label>Phone (07... or +254...)</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0712345678" /></div>
                <div>
                  <Label>Role (Optional)</Label>
                  <Select value={form.role || "none"} onValueChange={value => setForm(f => ({ ...f, role: value === "none" ? "" : value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Role</SelectItem>
                      <SelectItem value="admin">Administrator</SelectItem>
                      <SelectItem value="chairperson">Chairperson</SelectItem>
                      <SelectItem value="vice_chairperson">Vice Chairperson</SelectItem>
                      <SelectItem value="secretary">Secretary</SelectItem>
                      <SelectItem value="vice_secretary">Vice Secretary</SelectItem>
                      <SelectItem value="patron">Patron</SelectItem>
                      <SelectItem value="executive">Executive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => addMember.mutate()} disabled={addMember.isPending || !form.name || !form.phone || !form.member_id} className="w-full">
                  {addMember.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</> : "Add Member"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Members ({members?.length || 0})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>ID Number</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Total Contributions</TableHead>
                <TableHead>Penalties</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>}
              {members?.map((m) => {
                const memberRole = getMemberRole(m.id);
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell>{m.phone}</TableCell>
                    <TableCell>{m.member_id || "—"}</TableCell>
                    <TableCell>
                      {memberRole ? (
                        <Badge className={`${getRoleColor(memberRole as any)} text-white`}>
                          {getRoleLabel(memberRole as any)}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Member</Badge>
                      )}
                    </TableCell>
                    <TableCell>KES {Number(m.total_contributions).toLocaleString()}</TableCell>
                    <TableCell className={Number(m.total_penalties) > 0 ? "text-destructive font-medium" : ""}>
                      KES {Number(m.total_penalties).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.is_active ? "default" : "secondary"}>
                        {m.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Link to={`/admin/members/${m.id}`}>
                          <Button variant="ghost" size="icon" title="View Member">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="icon" title="Edit Member" onClick={() => {
                          setSelectedMember(m);
                          const memberRole = getMemberRole(m.id) || "";
                          setEditForm({ name: m.name, phone: m.phone, member_id: m.member_id || "", role: memberRole });
                          setEditOpen(true);
                        }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Manage Beneficiaries" onClick={() => {
                          setSelectedMember(m);
                          setBeneficiariesOpen(true);
                        }}>
                          <Users className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Assign Role" onClick={() => handleAssignRole(m)}>
                          <Shield className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" title="Delete Member" onClick={() => { 
                          if (confirm(`Delete ${m.name}?`)) deleteMember.mutate(m.id); 
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
            <DialogDescription>Update member information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
            </div>
            <div>
              <Label>ID Number</Label>
              <Input value={editForm.member_id} onChange={e => setEditForm(f => ({ ...f, member_id: e.target.value }))} placeholder="e.g. 32580859" />
            </div>
            <div>
              <Label>Phone (07... or +254...)</Label>
              <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="0712345678" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={editForm.role || "none"} onValueChange={value => setEditForm(f => ({ ...f, role: value === "none" ? "" : value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Role</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="chairperson">Chairperson</SelectItem>
                  <SelectItem value="vice_chairperson">Vice Chairperson</SelectItem>
                  <SelectItem value="secretary">Secretary</SelectItem>
                  <SelectItem value="vice_secretary">Vice Secretary</SelectItem>
                  <SelectItem value="patron">Patron</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => updateMember.mutate()} disabled={updateMember.isPending || !editForm.name || !editForm.phone} className="w-full">
              {updateMember.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating...</>
              ) : (
                "Update Member"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={beneficiariesOpen} onOpenChange={setBeneficiariesOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Manage Beneficiaries - {selectedMember?.name}</DialogTitle>
            <DialogDescription>Add and manage member beneficiaries</DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="list" className="w-full">
            <TabsList>
              <TabsTrigger value="list">Beneficiaries List</TabsTrigger>
              <TabsTrigger value="add">Add Beneficiary</TabsTrigger>
            </TabsList>
            
            <TabsContent value="list" className="space-y-4">
              {beneficiariesLoading ? (
                <div className="text-center py-4">Loading beneficiaries...</div>
              ) : beneficiaries?.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">No beneficiaries added yet</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Relationship</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>ID Number</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {beneficiaries?.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.name}</TableCell>
                        <TableCell>{b.relationship}</TableCell>
                        <TableCell>{b.phone || "—"}</TableCell>
                        <TableCell>{b.id_number || "—"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
                            if (confirm(`Remove ${b.name} as beneficiary?`)) {
                              deleteBeneficiary.mutate(b.id);
                            }
                          }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
            
            <TabsContent value="add" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Beneficiary Name</Label>
                  <Input value={beneficiaryForm.name} onChange={e => setBeneficiaryForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
                </div>
                <div>
                  <Label>Relationship</Label>
                  <Select value={beneficiaryForm.relationship} onValueChange={value => setBeneficiaryForm(f => ({ ...f, relationship: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spouse">Spouse</SelectItem>
                      <SelectItem value="child">Child</SelectItem>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="next_of_kin">Next of Kin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Phone (Optional)</Label>
                  <Input value={beneficiaryForm.phone} onChange={e => setBeneficiaryForm(f => ({ ...f, phone: e.target.value }))} placeholder="0712345678" />
                </div>
                <div>
                  <Label>ID Number (Optional)</Label>
                  <Input value={beneficiaryForm.id_number} onChange={e => setBeneficiaryForm(f => ({ ...f, id_number: e.target.value }))} placeholder="e.g. 32580859" />
                </div>
              </div>
              <Button onClick={() => addBeneficiary.mutate()} disabled={addBeneficiary.isPending || !beneficiaryForm.name || !beneficiaryForm.relationship} className="w-full">
                {addBeneficiary.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding...</>
                ) : (
                  "Add Beneficiary"
                )}
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role to {selectedMember?.name}</DialogTitle>
            <DialogDescription>Select an office bearer role for this member</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="chairperson">Chairperson</SelectItem>
                  <SelectItem value="vice_chairperson">Vice Chairperson</SelectItem>
                  <SelectItem value="secretary">Secretary</SelectItem>
                  <SelectItem value="vice_secretary">Vice Secretary</SelectItem>
                  <SelectItem value="patron">Patron</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (selectedRole && selectedMember) {
                    assignRole.mutate({ memberId: selectedMember.id, role: selectedRole });
                  }
                }}
                disabled={!selectedRole || assignRole.isPending}
                className="flex-1"
              >
                {assignRole.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Assigning...</>
                ) : (
                  "Assign Role"
                )}
              </Button>
              {getMemberRole(selectedMember?.id) && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (selectedMember) {
                      removeRole.mutate(selectedMember.id);
                    }
                  }}
                  disabled={removeRole.isPending}
                >
                  {removeRole.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Removing...</>
                  ) : (
                    "Remove Role"
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
