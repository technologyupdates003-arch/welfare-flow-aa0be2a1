import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Loader2, Users, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

// Capitalize each word in a name properly
const capitalizeNames = (name: string): string => {
  if (!name) return "";
  return name
    .split(/\s+/)
    .map(word => {
      if (word.length === 0) return "";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
};

export default function Beneficiaries() {
  const queryClient = useQueryClient();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<any>(null);
  const [form, setForm] = useState({ name: "", relationship: "", phone: "", id_number: "" });
  const [memberSearch, setMemberSearch] = useState("");

  const { data: beneficiaries = [], isLoading } = useQuery({
    queryKey: ["beneficiaries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beneficiaries")
        .select(`id, member_id, name, relationship, phone, id_number, member:members(name, phone)`)
        .order("member_id", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const updateBeneficiary = useMutation({
    mutationFn: async () => {
      if (!selectedBeneficiary) throw new Error("No beneficiary selected");
      const { error } = await supabase
        .from("beneficiaries")
        .update({
          name: form.name,
          relationship: form.relationship,
          phone: form.phone || null,
          id_number: form.id_number || null,
        })
        .eq("id", selectedBeneficiary.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["beneficiaries"] });
      setEditDialogOpen(false);
      setSelectedBeneficiary(null);
      setForm({ name: "", relationship: "", phone: "", id_number: "" });
      toast.success("Beneficiary updated successfully");
    },
    onError: (error: any) => toast.error(error.message || "Failed to update beneficiary"),
  });

  const deleteBeneficiary = useMutation({
    mutationFn: async (beneficiaryId: string) => {
      const { error } = await supabase.from("beneficiaries").delete().eq("id", beneficiaryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["beneficiaries"] });
      toast.success("Beneficiary removed successfully");
    },
    onError: (error: any) => toast.error(error.message || "Failed to remove beneficiary"),
  });

  const openEditDialog = (beneficiary: any) => {
    setSelectedBeneficiary(beneficiary);
    setForm({
      name: beneficiary.name || "",
      relationship: beneficiary.relationship || "",
      phone: beneficiary.phone || "",
      id_number: beneficiary.id_number || "",
    });
    setEditDialogOpen(true);
  };

  const filteredBeneficiaries = beneficiaries.filter((beneficiary: any) => {
    const search = memberSearch.trim().toLowerCase();
    if (!search) return true;
    const memberName = beneficiary.member?.name?.toLowerCase() || "";
    const beneficiaryName = beneficiary.name?.toLowerCase() || "";
    return memberName.includes(search) || beneficiaryName.includes(search);
  });

  // Group beneficiaries by member
  const groupedByMember = filteredBeneficiaries.reduce((groups: any, beneficiary: any) => {
    const memberId = beneficiary.member_id;
    if (!groups[memberId]) {
      groups[memberId] = {
        member: beneficiary.member,
        beneficiaries: []
      };
    }
    groups[memberId].beneficiaries.push(beneficiary);
    return groups;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Beneficiary Dashboard</h1>
          <p className="text-muted-foreground text-sm">Edit names, phone numbers, IDs, and remove beneficiaries directly.</p>
        </div>
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit beneficiary</DialogTitle>
              <DialogDescription>Update name, relationship, phone, or ID number.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Full Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>Relationship</Label>
                <Input value={form.relationship} onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <Label>ID Number</Label>
                <Input value={form.id_number} onChange={e => setForm(f => ({ ...f, id_number: e.target.value }))} />
              </div>
              <Button
                className="w-full"
                onClick={() => updateBeneficiary.mutate()}
                disabled={!form.name || !selectedBeneficiary || updateBeneficiary.isPending}
              >
                {updateBeneficiary.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Beneficiaries
          </CardTitle>
          <CardDescription>Admins can edit beneficiary names, phone numbers, and ID numbers here.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Label htmlFor="member-search">Search beneficiaries by member name</Label>
            <Input
              id="member-search"
              placeholder="Search member name..."
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              className="mt-2"
            />
          </div>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : beneficiaries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No beneficiaries found.</div>
          ) : Object.keys(groupedByMember).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No beneficiaries match this member search.</div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedByMember).map(([memberId, group]: any) => (
                <Card key={memberId} className="border-l-4 border-l-primary">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{capitalizeNames(group.member?.name) || "Unknown Member"}</CardTitle>
                    <CardDescription className="text-sm">{group.member?.phone || "No phone"} • {group.beneficiaries.length} beneficiary(ies)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {group.beneficiaries.map((beneficiary: any) => (
                        <div key={beneficiary.id} className="flex items-start justify-between gap-3 p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                          <div className="flex-1">
                            <p className="font-medium">{capitalizeNames(beneficiary.name) || "Unknown"}</p>
                            <p className="text-sm text-muted-foreground capitalize">{beneficiary.relationship || "Unknown"}</p>
                            {beneficiary.phone && <p className="text-xs text-muted-foreground mt-1">📱 {beneficiary.phone}</p>}
                            {beneficiary.id_number && <p className="text-xs text-muted-foreground">🆔 {beneficiary.id_number}</p>}
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEditDialog(beneficiary)}>
                              <Pencil className="mr-1 h-4 w-4" /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteBeneficiary.mutate(beneficiary.id)}
                            >
                              <Trash2 className="mr-1 h-4 w-4" /> Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
