import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useEffectiveIdentity } from "@/lib/impersonate-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function MemberDocuments() {
  const { user } = useAuth();
  const { userId: effectiveUserId, memberId: effectiveMemberId, isImpersonating } = useEffectiveIdentity();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState("id_photo");
  const [notes, setNotes] = useState("");

  const { data: member } = useQuery({
    queryKey: ["my-member", effectiveMemberId, effectiveUserId],
    queryFn: async () => {
      const query = supabase.from("members").select("id");
      const { data } = effectiveMemberId
        ? await query.eq("id", effectiveMemberId).maybeSingle()
        : await query.eq("user_id", effectiveUserId!).maybeSingle();
      return data;
    },
    enabled: !!(effectiveMemberId || effectiveUserId),
  });

  const { data: documents, isLoading } = useQuery({
    queryKey: ["my-documents", member?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("member_id", member!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!member,
  });

  const uploadDoc = useMutation({
    mutationFn: async () => {
      if (isImpersonating) throw new Error("Read-only: you are viewing this member as an admin");
      if (!file || !member) throw new Error("No file selected");
      const ext = file.name.split(".").pop();
      const path = `${effectiveUserId || user!.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);
      if (uploadError) throw uploadError;
      const { error } = await supabase.from("documents").insert({
        member_id: member.id,
        file_name: file.name,
        file_type: fileType,
        file_url: path,
        uploaded_by: effectiveUserId || user!.id,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-documents"] });
      toast.success("Document uploaded successfully");
      setFile(null);
      setNotes("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusColor = (s: string) => s === "approved" ? "default" : s === "rejected" ? "destructive" : "secondary";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Upload Document</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Document Type</Label>
            <Select value={fileType} onValueChange={setFileType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="id_photo">ID Photo</SelectItem>
                <SelectItem value="kyc">KYC Document</SelectItem>
                <SelectItem value="certificate">Certificate</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>File</Label>
            <Input type="file" accept="image/*,.pdf,.doc,.docx" onChange={e => setFile(e.target.files?.[0] || null)} />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes..." />
          </div>
          <Button onClick={() => uploadDoc.mutate()} disabled={!file || !member || uploadDoc.isPending}>
            <Upload className="h-4 w-4 mr-2" /> {uploadDoc.isPending ? "Uploading..." : "Upload"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>My Documents</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : documents?.length === 0 ? (
            <p className="text-muted-foreground text-sm">No documents uploaded yet.</p>
          ) : (
            <div className="space-y-3">
              {documents?.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{doc.file_name}</p>
                      <p className="text-xs text-muted-foreground">{doc.file_type} · {format(new Date(doc.created_at), "dd MMM yyyy")}</p>
                    </div>
                  </div>
                  <Badge variant={statusColor(doc.status)}>{doc.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
