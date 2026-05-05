import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, FileText, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function ApproveMinutes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedMinutes, setSelectedMinutes] = useState<any>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [uploadedSignatureFile, setUploadedSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewMinuteHtml, setViewMinuteHtml] = useState("");

  // Reset signature upload when dialog closes
  useEffect(() => {
    if (!approveDialogOpen) {
      setUploadedSignatureFile(null);
      setSignaturePreview(null);
    }
  }, [approveDialogOpen]);

  const { data: minutesForReview = [] } = useQuery({
    queryKey: ["minutes-for-review"],
    queryFn: async () => {
      const { data } = await supabase
        .from("meeting_minutes")
        .select("*")
        .in("status", ["secretary_reviewed", "submitted"])
        .order("secretary_reviewed_at", { ascending: false })
        .order("submitted_at", { ascending: false })
        .order("meeting_date", { ascending: false });
      return data || [];
    },
  });

  const { data: chairpersonSignature } = useQuery({
    queryKey: ["chairperson-signature"],
    queryFn: async () => {
      const { data } = await supabase
        .from("office_bearer_signatures")
        .select("*")
        .eq("role", "chairperson")
        .single();
      return data;
    },
    refetchOnWindowFocus: true, // Refetch when window/tab gets focus
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      // Get the chairperson's current signature
      const { data: currentSignature } = await supabase
        .from("office_bearer_signatures")
        .select("signature_url")
        .eq("role", "chairperson")
        .single();

      let signatureUrl = currentSignature?.signature_url;

      // If no signature exists, allow inline upload
      if (!signatureUrl) {
        // Check if a file was uploaded
        if (!uploadedSignatureFile) {
          throw new Error("Please upload your signature to approve these minutes");
        }
        
        // Upload the signature file
        const fileExt = uploadedSignatureFile.name.split('.').pop();
        const fileName = `chairperson-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError, data } = await supabase.storage
          .from('signatures')
          .upload(filePath, uploadedSignatureFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw new Error(`Failed to upload signature: ${uploadError.message}`);

        const { data: { publicUrl } } = supabase.storage
          .from('signatures')
          .getPublicUrl(filePath);

        signatureUrl = publicUrl;

        // Save the signature URL to office_bearer_signatures table
        // First check if record exists
        const { data: existingRecord } = await supabase
          .from("office_bearer_signatures")
          .select("id")
          .eq("role", "chairperson")
          .single();

        let saveError;
        if (existingRecord?.id) {
          // Update existing record
          const { error } = await supabase
            .from("office_bearer_signatures")
            .update({
              signature_url: signatureUrl,
              updated_at: new Date().toISOString()
            })
            .eq("role", "chairperson");
          saveError = error;
        } else {
          // Insert new record (shouldn't happen since default records exist)
          const { error } = await supabase
            .from("office_bearer_signatures")
            .insert({
              role: "chairperson",
              signature_url: signatureUrl,
              updated_at: new Date().toISOString()
            });
          saveError = error;
        }

        if (saveError) {
          console.error("Failed to save signature:", saveError);
          // Continue anyway - we have the URL
        }
      }

      // Get chairperson's full name from members table
      const { data: chairpersonMember } = await supabase
        .from("members")
        .select("name")
        .eq("user_id", user?.id)
        .single();

      const chairpersonName = chairpersonMember?.name || "Chairperson";

      // Determine visibility based on meeting type
      const isExecutiveMeeting = selectedMinutes?.meeting_type === "executive";
      
      const { error } = await supabase
        .from("meeting_minutes")
        .update({
          status: "approved",
          chairperson_name: chairpersonName,
          chairperson_signature_url: signatureUrl,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          // For executive meetings, only visible to members with roles
          // For general meetings, visible to all members
          visible_to_members: isExecutiveMeeting ? selectedMinutes?.visible_to_members || [] : []
        })
        .eq("id", selectedMinutes.id);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["draft-minutes"] });
      queryClient.invalidateQueries({ queryKey: ["chairperson-signature"] });
      setApproveDialogOpen(false);
      setSelectedMinutes(null);
      setApprovalNotes("");
      setUploadedSignatureFile(null);
      setSignaturePreview(null);
      toast.success("Meeting minutes approved and signature added!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file (PNG, JPG, etc.)");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size should be less than 2MB");
      return;
    }

    setUploadedSignatureFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setSignaturePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const [rejectionNotes, setRejectionNotes] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  const generateMinuteHtml = (minute: any) => {
    return `<!DOCTYPE html><html><head><title>${minute.title}</title>
    <style>body{font-family:Arial,sans-serif;margin:40px;line-height:1.8;max-width:900px;margin:0 auto;padding:40px}
    .header{text-align:center;margin-bottom:40px;border-bottom:3px solid #16a34a;padding-bottom:20px}
    .header h1{margin:0;color:#16a34a;font-size:28px}.header h2{margin:10px 0;color:#333;font-size:20px}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:20px 0;padding:15px;background:#f9fafb;border-radius:8px}
    .meta-item{font-size:14px}.meta-label{font-weight:bold;color:#666}
    .section{margin:30px 0}.section h3{color:#16a34a;border-bottom:2px solid #e5e7eb;padding-bottom:8px;margin-bottom:15px;font-size:18px}
    .section-content{padding-left:15px;white-space:pre-wrap;line-height:1.8}
    .attendees{display:flex;flex-wrap:wrap;gap:8px;padding-left:15px}
    .attendee-badge{background:#e5e7eb;padding:6px 12px;border-radius:20px;font-size:13px}
    .signatures{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:60px;padding-top:30px;border-top:2px solid #e5e7eb}
    .signature-block{text-align:center}
    .signature-img{max-width:200px;max-height:80px;margin:10px auto;display:block}
    .signature-line{border-top:2px solid #333;margin:20px auto 10px;width:200px}
    .signature-name{font-weight:bold;margin-top:5px}
    .signature-title{font-size:12px;color:#666}
    @media print{body{margin:20px}}</style></head><body>
    <div class="header">
    <h1>KIRINYAGA HEALTHCARE WORKERS' WELFARE</h1>
    <h2>Meeting Minutes</h2>
    <h3>${minute.title}</h3>
    </div>
    <div class="meta">
    <div class="meta-item"><span class="meta-label">Meeting Date:</span> ${new Date(minute.meeting_date).toLocaleDateString()}</div>
    <div class="meta-item"><span class="meta-label">Meeting Type:</span> ${minute.meeting_type.replace('_', ' ').toUpperCase()}</div>
    <div class="meta-item"><span class="meta-label">Status:</span> ${minute.status.toUpperCase()}</div>
    ${minute.next_meeting_date ? `<div class="meta-item"><span class="meta-label">Next Meeting:</span> ${new Date(minute.next_meeting_date).toLocaleDateString()}</div>` : ''}
    </div>
    ${minute.attendees && minute.attendees.length > 0 ? `<div class="section"><h3>Attendees</h3>
    <div class="attendees">${minute.attendees.map((a: string) => `<span class="attendee-badge">${a}</span>`).join('')}</div></div>` : ''}
    ${minute.agenda ? `<div class="section"><h3>Agenda</h3><div class="section-content">${minute.agenda}</div></div>` : ''}
    ${minute.discussions ? `<div class="section"><h3>Discussions</h3><div class="section-content">${minute.discussions}</div></div>` : ''}
    ${minute.decisions ? `<div class="section"><h3>Decisions Made</h3><div class="section-content">${minute.decisions}</div></div>` : ''}
    ${minute.action_items ? `<div class="section"><h3>Action Items</h3><div class="section-content">${minute.action_items}</div></div>` : ''}
    <div class="signatures">
      <div class="signature-block">
        ${minute.chairperson_signature_url ? `<img src="${minute.chairperson_signature_url}" alt="Chairperson Signature" class="signature-img" />` : '<div class="signature-line"></div>'}
        <div class="signature-name">${minute.chairperson_name || '_____________________'}</div>
        <div class="signature-title">Chairperson</div>
      </div>
      <div class="signature-block">
        ${minute.secretary_signature_url ? `<img src="${minute.secretary_signature_url}" alt="Secretary Signature" class="signature-img" />` : '<div class="signature-line"></div>'}
        <div class="signature-name">${minute.secretary_name || '_____________________'}</div>
        <div class="signature-title">Secretary</div>
      </div>
    </div>
    <p style="margin-top:60px;text-align:center;color:#666;font-size:12px;border-top:1px solid #e5e7eb;padding-top:20px">
    Generated from KIRINYAGA HCWW System | ${new Date().toLocaleDateString()}</p>
    </body></html>`;
  };

  const viewMinutes = (minute: any) => {
    setSelectedMinutes(minute);
    setViewMinuteHtml(generateMinuteHtml(minute));
    setViewDialogOpen(true);
  };

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("meeting_minutes")
        .update({
          status: "rejected_by_chairperson",
          rejection_notes: rejectionNotes,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq("id", selectedMinutes.id);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["minutes-for-review"] });
      setSelectedMinutes(null);
      setRejectionNotes("");
      setRejectDialogOpen(false);
      toast.success("Meeting minutes rejected and sent back to Secretary");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <CheckCircle className="h-8 w-8" />
          Approve Meeting Minutes
        </h1>
        <Badge variant={chairpersonSignature?.signature_url ? "default" : "secondary"}>
          {chairpersonSignature?.signature_url ? "Signature Ready" : "Upload Signature"}
        </Badge>
      </div>

      {!chairpersonSignature?.signature_url && (
        <Card className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-yellow-900 dark:text-yellow-100">Signature Notice</p>
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                Your signature will be automatically added when you approve minutes. 
                Please upload your signature in the Chairperson Signature page for it to be prefilled.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {minutesForReview.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No meeting minutes to review</p>
            </CardContent>
          </Card>
        ) : (
          minutesForReview.map((minutes: any) => (
            <Card key={minutes.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="flex-1">
                  <CardTitle className="text-lg">{minutes.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(minutes.meeting_date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <Badge variant="secondary">{minutes.meeting_type}</Badge>
                  <Badge variant={
                    minutes.status === "secretary_reviewed" ? "default" : 
                    minutes.status === "submitted" ? "secondary" : 
                    minutes.status === "draft" ? "secondary" : 
                    "outline"
                  }>
                    {minutes.status === "secretary_reviewed" ? "Ready for Approval" : minutes.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Attendees</p>
                    <p className="font-medium">{minutes.attendees?.length || 0} members</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Created By</p>
                    <p className="font-medium">Secretary</p>
                  </div>
                </div>

                {minutes.agenda && (
                  <div>
                    <p className="text-sm font-medium mb-1">Agenda</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{minutes.agenda}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => viewMinutes(minutes)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View Minutes
                  </Button>
                  
                  <Dialog open={approveDialogOpen && selectedMinutes?.id === minutes.id} onOpenChange={setApproveDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        className="flex-1"
                        onClick={() => setSelectedMinutes(minutes)}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Approve Meeting Minutes</DialogTitle>
                        <DialogDescription>
                          Your signature will be automatically added to these minutes
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-medium mb-2">Minutes Title</p>
                          <p className="text-sm text-muted-foreground">{selectedMinutes?.title}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-2">Your Signature</p>
                          {chairpersonSignature?.signature_url ? (
                            <div>
                              <img
                                src={chairpersonSignature.signature_url}
                                alt="Your signature"
                                className="h-16 object-contain bg-gray-50 dark:bg-gray-900 rounded border border-border p-2"
                              />
                              <p className="text-xs text-green-600 mt-1">✓ Your signature is ready and will be automatically added</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {signaturePreview ? (
                                <div>
                                  <img
                                    src={signaturePreview}
                                    alt="Signature preview"
                                    className="h-16 object-contain bg-gray-50 dark:bg-gray-900 rounded border border-border p-2"
                                  />
                                  <p className="text-xs text-green-600 mt-1">✓ New signature ready for upload</p>
                                </div>
                              ) : (
                                <div className="p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                    <AlertCircle className="h-4 w-4 inline mr-1" />
                                    Upload your signature to approve these minutes
                                  </p>
                                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                                    Your signature will be saved for future approvals
                                  </p>
                                </div>
                              )}
                              
                              <div>
                                <Label htmlFor="signature-upload" className="text-sm font-medium mb-2 block">
                                  Upload Signature Image
                                </Label>
                                <Input
                                  id="signature-upload"
                                  type="file"
                                  accept="image/*"
                                  onChange={handleSignatureUpload}
                                  className="cursor-pointer"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                  Upload a clear image of your signature (PNG, JPG, max 2MB)
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-2">Approval Notes (Optional)</p>
                          <Textarea
                            value={approvalNotes}
                            onChange={e => setApprovalNotes(e.target.value)}
                            placeholder="Add any notes about this approval..."
                            rows={3}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setApproveDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => approveMutation.mutate()}
                            disabled={approveMutation.isPending || (!chairpersonSignature?.signature_url && !uploadedSignatureFile)}
                            className="flex-1"
                          >
                            {approveMutation.isPending ? (
                              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Approving...</>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Approve & Sign
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={rejectDialogOpen && selectedMinutes?.id === minutes.id} onOpenChange={setRejectDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setSelectedMinutes(minutes);
                          setRejectionNotes("");
                        }}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject with Notes
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Reject Meeting Minutes</DialogTitle>
                        <DialogDescription>
                          Provide feedback on what needs to be corrected
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-medium mb-2">Minutes Title</p>
                          <p className="text-sm text-muted-foreground">{selectedMinutes?.title}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-2">Rejection Notes</p>
                          <Textarea
                            value={rejectionNotes}
                            onChange={e => setRejectionNotes(e.target.value)}
                            placeholder="Explain what needs to be corrected..."
                            rows={4}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            This feedback will be sent to the secretary for corrections
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setRejectDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => rejectMutation.mutate()}
                            disabled={rejectMutation.isPending || !rejectionNotes.trim()}
                            className="flex-1"
                          >
                            {rejectMutation.isPending ? (
                              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Rejecting...</>
                            ) : (
                              <>
                                <XCircle className="h-4 w-4 mr-2" />
                                Reject with Feedback
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-sm mb-2">New Workflow Process:</h3>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Vice Secretary creates draft minutes</li>
            <li>Vice Secretary submits to Secretary for review</li>
            <li>Secretary reviews and either approves or rejects with feedback</li>
            <li>If approved by Secretary, minutes are forwarded to you for final approval</li>
            <li>You review Secretary-approved minutes and either approve or reject</li>
            <li>When approving, your signature is automatically added</li>
            <li>When rejecting, provide feedback - minutes go back to Secretary</li>
            <li>General meetings become visible to all members when approved</li>
            <li>Executive meetings are only visible to members with roles</li>
          </ul>
        </CardContent>
      </Card>

      {/* View Minutes Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{selectedMinutes?.title}</DialogTitle>
            <DialogDescription>
              {selectedMinutes && new Date(selectedMinutes.meeting_date).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          {viewMinuteHtml && (
            <div dangerouslySetInnerHTML={{ __html: viewMinuteHtml }} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
