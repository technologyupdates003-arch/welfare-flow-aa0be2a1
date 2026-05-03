import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Users, Shield } from "lucide-react";

interface SettingsForm {
  name: string;
  monthly_contribution_amount: number;
  contribution_due_day: number;
  penalty_amount: number;
  penalty_grace_days: number;
}

export default function Settings() {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm<SettingsForm>();
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");

  const { data: settings, isLoading } = useQuery({
    queryKey: ["welfare-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("welfare_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: membersWithRoles } = useQuery({
    queryKey: ["members-with-roles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("members")
        .select(`
          id, name, phone,
          user_roles!inner(role)
        `)
        .order("name");
      return data || [];
    },
  });

  const { data: membersWithoutRoles } = useQuery({
    queryKey: ["members-without-roles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("members")
        .select(`
          id, name, phone, user_id
        `)
        .is("user_id", null)
        .order("name");
      return data || [];
    },
  });

  useEffect(() => {
    if (settings) {
      reset({
        name: settings.name,
        monthly_contribution_amount: settings.monthly_contribution_amount,
        contribution_due_day: settings.contribution_due_day,
        penalty_amount: settings.penalty_amount,
        penalty_grace_days: settings.penalty_grace_days,
      });
    }
  }, [settings, reset]);

  const updateSettings = useMutation({
    mutationFn: async (values: SettingsForm) => {
      if (settings?.id) {
        const { error } = await supabase.from("welfare_settings").update(values).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("welfare_settings").insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["welfare-settings"] });
      toast.success("Settings updated successfully");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const assignRole = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      // First, get the member's user_id
      const { data: member } = await supabase
        .from("members")
        .select("user_id")
        .eq("id", memberId)
        .single();
      
      if (!member?.user_id) {
        throw new Error("Member must have a user account to assign roles");
      }

      // Assign the role
      const { error } = await supabase
        .from("user_roles")
        .upsert({ user_id: member.user_id, role: role as any });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["members-without-roles"] });
      setRoleDialogOpen(false);
      setSelectedMember(null);
      setSelectedRole("");
      toast.success("Role assigned successfully");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeRole = useMutation({
    mutationFn: async (memberId: string) => {
      const { data: member } = await supabase
        .from("members")
        .select("user_id")
        .eq("id", memberId)
        .single();
      
      if (!member?.user_id) return;

      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", member.user_id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["members-without-roles"] });
      toast.success("Role removed successfully");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleAssignRole = (member: any) => {
    setSelectedMember(member);
    setRoleDialogOpen(true);
  };

  const roleLabels = {
    admin: "Administrator",
    chairperson: "Chairperson",
    vice_chairperson: "Vice Chairperson",
    secretary: "Secretary",
    vice_secretary: "Vice Secretary",
    patron: "Patron",
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <form onSubmit={handleSubmit((v) => updateSettings.mutate(v))} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Welfare Group</CardTitle>
            <CardDescription>Configure your welfare group settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Welfare Name</Label>
              <Input id="name" {...register("name", { required: true })} placeholder="e.g. Harambee Welfare Group" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contribution Settings</CardTitle>
            <CardDescription>Set the monthly contribution amount and due date</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="amount">Monthly Contribution (KES)</Label>
              <Input id="amount" type="number" {...register("monthly_contribution_amount", { required: true, valueAsNumber: true })} />
            </div>
            <div>
              <Label htmlFor="due_day">Due Day of Month (1-28)</Label>
              <Input id="due_day" type="number" min={1} max={28} {...register("contribution_due_day", { required: true, valueAsNumber: true, min: 1, max: 28 })} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Penalty Settings</CardTitle>
            <CardDescription>Configure penalty for late payments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="penalty">Penalty Amount (KES)</Label>
              <Input id="penalty" type="number" {...register("penalty_amount", { required: true, valueAsNumber: true })} />
            </div>
            <div>
              <Label htmlFor="grace">Grace Period (days after due date)</Label>
              <Input id="grace" type="number" min={0} {...register("penalty_grace_days", { required: true, valueAsNumber: true, min: 0 })} />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={updateSettings.isPending}>
          {updateSettings.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </form>

      {/* Role Management Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role Management
          </CardTitle>
          <CardDescription>Assign office bearer roles to members</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Current Role Holders */}
            <div>
              <h4 className="font-medium mb-3">Current Office Bearers</h4>
              {membersWithRoles?.length === 0 ? (
                <p className="text-muted-foreground text-sm">No roles assigned yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {membersWithRoles?.map((member: any) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">{member.name}</TableCell>
                        <TableCell>{member.phone}</TableCell>
                        <TableCell>
                          <Badge variant="default">
                            {roleLabels[member.user_roles?.role as keyof typeof roleLabels] || member.user_roles?.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm(`Remove role from ${member.name}?`)) {
                                removeRole.mutate(member.id);
                              }
                            }}
                            disabled={removeRole.isPending}
                          >
                            Remove Role
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Assign New Roles */}
            <div>
              <h4 className="font-medium mb-3">Assign New Roles</h4>
              {membersWithoutRoles?.length === 0 ? (
                <p className="text-muted-foreground text-sm">All members with accounts have been assigned roles</p>
              ) : (
                <div className="space-y-2">
                  {membersWithoutRoles?.slice(0, 5).map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{member.name}</div>
                        <div className="text-sm text-muted-foreground">{member.phone}</div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAssignRole(member)}
                      >
                        Assign Role
                      </Button>
                    </div>
                  ))}
                  {(membersWithoutRoles?.length || 0) > 5 && (
                    <p className="text-sm text-muted-foreground">
                      And {(membersWithoutRoles?.length || 0) - 5} more members available for role assignment
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role Assignment Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role to {selectedMember?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chairperson">Chairperson</SelectItem>
                  <SelectItem value="vice_chairperson">Vice Chairperson</SelectItem>
                  <SelectItem value="secretary">Secretary</SelectItem>
                  <SelectItem value="vice_secretary">Vice Secretary</SelectItem>
                  <SelectItem value="patron">Patron</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => {
                if (selectedRole && selectedMember) {
                  assignRole.mutate({ memberId: selectedMember.id, role: selectedRole });
                }
              }}
              disabled={!selectedRole || assignRole.isPending}
              className="w-full"
            >
              {assignRole.isPending ? "Assigning..." : "Assign Role"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
