import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, UserPlus, UserMinus, Users, Loader2, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReadableStreamDefaultController } from "node:stream/web";

export default function MemberBeneficiaries() {
  const { memberId } = useAuth();
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<any>(null);
  const [addForm, setAddForm] = useState({ name: "", relationship: "spouse", phone: "", id_number: "", reason: "" });
  const [removeForm, setRemoveForm] = useState({ reason: "" });

  const { data: beneficiaries, isLoading } = useQuery({
    queryKey: ["beneficiaries", memberId],
    queryFn: async () => {
      const { data } = await supabase
        .from("beneficiaries")
        .select("*")
        .eq("member_id", memberId!)
        .order("created_at");
      return data || [];
    },
    enabled: !!memberId,
  });

  const { data: requests, isLoading: requestsLoading } = useQuery({
    queryKey: ["beneficiary-requests", memberId],
    queryFn: async () => {
      const { data } = await supabase
        .from("beneficiary_requests")
        .select("*")
        .eq("member_id", memberId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!memberId,
  });

  const submitAddRequest = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("beneficiary_requests").insert({
        member_id: memberId!,
        request_type: "add",
        beneficiary_name: addForm.name,
        beneficiary_relationship: addForm.relationship,
        beneficiary_phone: addForm.phone || null,
        beneficiary_id_number: addForm.id_number || null,
        reason: addForm.reason,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["beneficiary-requests"] });
      setAddDialogOpen(false);
      setAddForm({ name: "", relationship: "spouse", phone: "", id_number: "", reason: "" });
      toast.success("Request submitted! Admin will review it.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitRemoveRequest = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("beneficiary_requests").insert({
        member_id: memberId!,
        request_type: "remove",
        beneficiary_id: selectedBeneficiary.id,
        reason: removeForm.reason,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["beneficiary-requests"] });
      setRemoveDialogOpen(false);
      setRemoveForm({ reason: "" });
      setSelectedBeneficiary(null);
      toast.success("Removal request submitted! Admin will review it.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock className="h-4 w-4" />;
      case "approved": return <CheckCircle className="h-4 w-4" />;
      case "rejected": return <AlertCircle className="h-4 w-4" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "secondary";
      case "approved": return "success";
      case "rejected": return "destructive";
      default: return "default";
    }
  };

  const normalizeBeneficiaryName = (value: string) => {
    return String(value || "")
      .replace(/\b(yes|no|surname|other names|first name|name of|name)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const isPlaceholderBeneficiaryName = (value: string) => {
    const normalized = normalizeBeneficiaryName(value).toLowerCase();
    return normalized === "";
  };

  const formatBeneficiaryName = (beneficiary: any) => {
    const cleanedName = normalizeBeneficiaryName(beneficiary.name);
    if (!cleanedName) {
      switch (beneficiary.relationship?.toLowerCase?.()) {
        case "spouse":
          return "Spouse";
        case "child":
        case "child 1":
        case "child 2":
        case "child 3":
        case "child 4":
        case "child 5":
        case "child 6":
          return "Child";
        case "father":
          return "Father";
        case "mother":
          return "Mother";
        case "parent":
          return "Parent";
        case "spouse mother":
          return "Spouse Mother";
        case "spouse father":
          return "Spouse Father";
        case "next of kin":
          return "Next of Kin";
        default:
          return beneficiary.relationship
            ? beneficiary.relationship.charAt(0).toUpperCase() + beneficiary.relationship.slice(1)
            : "Beneficiary";
      }
    }

    return cleanedName;
  };

  const getRelationshipKey = (relationship: string) => {
    return String(relationship || "").trim().toLowerCase();
  };

  const formatRelationshipLabel = (relationship: string) => {
    const key = getRelationshipKey(relationship);

    switch (key) {
      case "spouse":
        return "Spouse";
      case "father":
        return "Father";
      case "mother":
        return "Mother";
      case "parent":
        return "Parent";
      case "spouse mother":
        return "Spouse Mother";
      case "spouse father":
        return "Spouse Father";
      case "next of kin":
        return "Next of Kin";
      default:
        return relationship
          ? relationship.charAt(0).toUpperCase() + relationship.slice(1)
          : "Beneficiary";
    }
  };

  const beneficiaryGroups = (beneficiaries || []).reduce(
    (groups, beneficiary) => {
      const key = getRelationshipKey(beneficiary.relationship);

      if (key === "spouse") {
        groups.spouse.push(beneficiary);
      } else if (key.startsWith("child")) {
        groups.children.push(beneficiary);
      } else if (key === "father" || key === "mother" || key === "parent") {
        groups.parents.push(beneficiary);
      } else if (key === "spouse mother" || key === "spouse father") {
        groups.spouseParents.push(beneficiary);
      } else if (key === "next of kin") {
        groups.nextOfKin.push(beneficiary);
      } else {
        groups.other.push(beneficiary);
      }

      return groups;
    },
    {
      spouse: [] as any[],
      children: [] as any[],
      parents: [] as any[],
      spouseParents: [] as any[],
      nextOfKin: [] as any[],
      other: [] as any[],
    }
  );

  const renderBeneficiaryCard = (beneficiary: any, label: string) => (
    <div key={beneficiary.id} className="p-4 border border-border rounded-lg bg-background">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-medium">{formatBeneficiaryName(beneficiary)}</p>
          <p className="text-xs text-muted-foreground capitalize">{formatRelationshipLabel(beneficiary.relationship)}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          onClick={() => {
            setSelectedBeneficiary(beneficiary);
            setRemoveDialogOpen(true);
          }}
        >
          <UserMinus className="h-4 w-4 mr-1" /> Request Removal
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Tabs defaultValue="beneficiaries" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="beneficiaries">My Beneficiaries</TabsTrigger>
          <TabsTrigger value="requests">
            My Requests
            {requests?.filter(r => r.status === "pending").length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {requests.filter(r => r.status === "pending").length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="beneficiaries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" /> My Beneficiaries
              </CardTitle>
              <CardDescription>
                View your registered beneficiaries. To add or remove, submit a request to admin.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : beneficiaries?.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground text-sm mb-4">No beneficiaries registered yet.</p>
                  <Button onClick={() => setAddDialogOpen(true)}>
                    <UserPlus className="h-4 w-4 mr-2" /> Request to Add Beneficiary
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {beneficiaryGroups.spouse.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold">Spouse</h3>
                        <div className="grid gap-3">
                          {beneficiaryGroups.spouse.map((b, index) => renderBeneficiaryCard(b, `Spouse${beneficiaryGroups.spouse.length > 1 ? ` ${index + 1}` : ""}`))}
                        </div>
                      </div>
                    )}

                    {beneficiaryGroups.children.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold">Children</h3>
                        <div className="grid gap-3">
                          {beneficiaryGroups.children.map((b, index) => renderBeneficiaryCard(b, `Child ${index + 1}`))}
                        </div>
                      </div>
                    )}

                    {beneficiaryGroups.parents.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold">Parents</h3>
                        <div className="grid gap-3">
                          {beneficiaryGroups.parents.map((b) => renderBeneficiaryCard(b, formatRelationshipLabel(b.relationship)))}
                        </div>
                      </div>
                    )}

                    {beneficiaryGroups.spouseParents.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold">Spouse's Parents</h3>
                        <div className="grid gap-3">
                          {beneficiaryGroups.spouseParents.map((b) => renderBeneficiaryCard(b, formatRelationshipLabel(b.relationship)))}
                        </div>
                      </div>
                    )}

                    {beneficiaryGroups.nextOfKin.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold">Next of Kin</h3>
                        <div className="grid gap-3">
                          {beneficiaryGroups.nextOfKin.map((b) => renderBeneficiaryCard(b, "Next of Kin"))}
                        </div>
                      </div>
                    )}

                    {beneficiaryGroups.other.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold">Other Beneficiaries</h3>
                        <div className="grid gap-3">
                          {beneficiaryGroups.other.map((b) => renderBeneficiaryCard(b, formatRelationshipLabel(b.relationship)))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-center pt-4">
                    <Button onClick={() => setAddDialogOpen(true)}>
                      <UserPlus className="h-4 w-4 mr-2" /> Request to Add Beneficiary
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>My Requests</CardTitle>
              <CardDescription>Track your beneficiary add/remove requests</CardDescription>
            </CardHeader>
            <CardContent>
              {requestsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : requests?.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No requests submitted yet.</p>
              ) : (
                <div className="space-y-3">
                  {requests?.map(req => (
                    <Card key={req.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant={req.request_type === "add" ? "default" : "secondary"}>
                                {req.request_type === "add" ? "Add" : "Remove"}
                              </Badge>
                              <Badge variant={getStatusColor(req.status) as any}>
                                <span className="flex items-center gap-1">
                                  {getStatusIcon(req.status)}
                                  {req.status}
                                </span>
                              </Badge>
                            </div>
                            {req.request_type === "add" ? (
                              <div className="mt-2">
                                <p className="font-medium">{req.beneficiary_name}</p>
                                <p className="text-sm text-muted-foreground capitalize">{req.beneficiary_relationship}</p>
                                {req.beneficiary_phone && <p className="text-sm text-muted-foreground">{req.beneficiary_phone}</p>}
                              </div>
                            ) : (
                              <p className="font-medium mt-2">Remove beneficiary request</p>
                            )}
                            <p className="text-sm text-muted-foreground mt-2">
                              <strong>Reason:</strong> {req.reason}
                            </p>
                            {req.admin_notes && (
                              <p className="text-sm text-muted-foreground mt-2">
                                <strong>Admin Notes:</strong> {req.admin_notes}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-2">
                              Submitted: {new Date(req.created_at).toLocaleDateString()}
                            </p>
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
      </Tabs>

      {/* Add Beneficiary Request Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request to Add Beneficiary</DialogTitle>
            <DialogDescription>Submit a request to add a new beneficiary. Admin will review and approve.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Full Name *</Label><Input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div>
              <Label>Relationship *</Label>
              <Select value={addForm.relationship} onValueChange={v => setAddForm(f => ({ ...f, relationship: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="spouse">Spouse</SelectItem>
                  <SelectItem value="child">Child</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                  <SelectItem value="sibling">Sibling</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Phone (optional)</Label><Input value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div><Label>ID Number (optional)</Label><Input value={addForm.id_number} onChange={e => setAddForm(f => ({ ...f, id_number: e.target.value }))} /></div>
            <div>
              <Label>Reason for Adding *</Label>
              <Textarea 
                value={addForm.reason} 
                onChange={e => setAddForm(f => ({ ...f, reason: e.target.value }))} 
                placeholder="Explain why you want to add this beneficiary..."
                rows={3}
              />
            </div>
            <Button 
              onClick={() => submitAddRequest.mutate()} 
              disabled={!addForm.name || !addForm.reason || submitAddRequest.isPending} 
              className="w-full"
            >
              {submitAddRequest.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Beneficiary Request Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request to Remove Beneficiary</DialogTitle>
            <DialogDescription>Submit a request to remove {selectedBeneficiary?.name}. Admin will review and approve.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{selectedBeneficiary?.name}</p>
              <p className="text-sm text-muted-foreground capitalize">{selectedBeneficiary?.relationship}</p>
            </div>
            <div>
              <Label>Reason for Removal *</Label>
              <Textarea 
                value={removeForm.reason} 
                onChange={e => setRemoveForm(f => ({ ...f, reason: e.target.value }))} 
                placeholder="Explain why you want to remove this beneficiary..."
                rows={3}
              />
            </div>
            <Button 
              onClick={() => submitRemoveRequest.mutate()} 
              disabled={!removeForm.reason || submitRemoveRequest.isPending} 
              className="w-full"
              variant="destructive"
            >
              {submitRemoveRequest.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Removal Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
