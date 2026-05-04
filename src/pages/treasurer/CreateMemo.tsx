import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Save, Send, Download, Plus, X, Bold, List, FileUp, Bell } from "lucide-react";
import { toast } from "sonner";
import logoImage from "@/assets/WhatsApp Image 2026-04-13 at 12.35.07.jpeg";

export default function CreateMemo() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const previewRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    title: "",
    category: "general_communication",
    content: "",
    recipientType: "all_members",
    selectedMembers: [] as string[],
  });
  const [showMemberSelector, setShowMemberSelector] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);

  // Fetch organization settings for letterhead
  const { data: orgSettings } = useQuery({
    queryKey: ["organization-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("organization_settings")
        .select("*")
        .single();
      return data;
    },
  });

  // Fetch memo templates
  const { data: templates = [] } = useQuery({
    queryKey: ["memo-templates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("memo_templates")
        .select("*")
        .order("name");
      return data || [];
    },
  });

  // Fetch all members for custom selection - SIMPLE DIRECT QUERY
  const { data: members = [], isLoading: membersLoading, error: membersError } = useQuery({
    queryKey: ["memo-members-list"],
    queryFn: async () => {
      try {
        console.log("Fetching members...");
        // Simple direct query - select all columns
        const { data, error, status } = await supabase
          .from("members")
          .select("*");
        
        console.log("Query status:", status);
        console.log("Query error:", error);
        console.log("Query data length:", data?.length);
        
        if (error) {
          console.error("Supabase error:", error);
          toast.error(`Failed to load members: ${error.message}`);
          return [];
        }
        
        if (!data) {
          console.warn("No data returned from query");
          return [];
        }
        
        console.log(`Total members fetched: ${data.length}`);
        console.log("Sample member:", data[0]);
        
        // Filter active members
        const activeMembers = data.filter((m: any) => m.is_active === true);
        console.log(`Active members: ${activeMembers.length}`);
        
        return activeMembers;
      } catch (err: any) {
        console.error("Exception:", err);
        toast.error(`Exception loading members: ${err.message}`);
        return [];
      }
    },
    staleTime: 0, // Always fresh
    retry: 1,
  });

  // Fetch executives - STRICT: only users with an assigned role in user_roles
  const { data: executives = [], isLoading: executivesLoading, error: executivesError } = useQuery({
    queryKey: ["memo-executives-list"],
    queryFn: async () => {
      try {
        // 1) Get all user_ids that have an assigned role (any role counts as "executive")
        const { data: roleRows, error: rolesErr } = await supabase
          .from("user_roles")
          .select("user_id");

        if (rolesErr) {
          console.error("Error fetching user_roles:", rolesErr);
          return [];
        }

        const userIds = Array.from(new Set((roleRows || []).map((r: any) => r.user_id).filter(Boolean)));
        if (userIds.length === 0) return [];

        // 2) Map them to active members
        const { data: roleMembers, error: memErr } = await supabase
          .from("members")
          .select("id, name, phone, is_active, user_id")
          .in("user_id", userIds)
          .eq("is_active", true)
          .order("name");

        if (memErr) {
          console.error("Error fetching role members:", memErr);
          return [];
        }

        return roleMembers || [];
      } catch (err: any) {
        console.error("Exception fetching executives:", err);
        return [];
      }
    },
    staleTime: 0,
    retry: 1,
  });

  // Generate reference number on mount
  useEffect(() => {
    const year = new Date().getFullYear();
    const randomNum = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    setReferenceNumber(`KHCWW-MEMO-${year}-${randomNum}`);
  }, []);

  // Save memo mutation
  const saveMemo = useMutation({
    mutationFn: async (isDraft: boolean) => {
      if (!formData.title.trim()) {
        throw new Error("Memo title is required");
      }
      if (!formData.content.trim()) {
        throw new Error("Memo content is required");
      }
      if (formData.recipientType === "custom_selection" && formData.selectedMembers.length === 0) {
        throw new Error("Please select at least one member");
      }

      setSaving(true);

      // Insert memo
      const { data: memoData, error: memoError } = await supabase
        .from("memos")
        .insert({
          reference_number: referenceNumber,
          title: formData.title,
          category: formData.category,
          content: formData.content,
          recipient_type: formData.recipientType,
          status: isDraft ? "draft" : "sent",
          created_by: user?.id,
          sent_at: isDraft ? null : new Date().toISOString(),
        })
        .select()
        .single();

      if (memoError) throw memoError;

      // Add recipients based on type
      let recipientIds: string[] = [];

      if (formData.recipientType === "all_members") {
        recipientIds = members.map((m) => m.id);
      } else if (formData.recipientType === "executives_only") {
        recipientIds = executives.map((e) => e.id);
      } else {
        recipientIds = formData.selectedMembers;
      }

      // Insert memo recipients
      if (recipientIds.length > 0) {
        const recipientRecords = recipientIds.map((memberId) => ({
          memo_id: memoData.id,
          member_id: memberId,
          delivered_at: isDraft ? null : new Date().toISOString(),
        }));

        const { error: recipientError } = await supabase
          .from("memo_recipients")
          .insert(recipientRecords);

        if (recipientError) throw recipientError;
      }

      setSaving(false);
      return memoData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["memos"] });
      toast.success(data.status === "draft" ? "Memo saved as draft" : "Memo sent successfully");
      // Reset form
      setFormData({
        title: "",
        category: "general_communication",
        content: "",
        recipientType: "all_members",
        selectedMembers: [],
      });
      const year = new Date().getFullYear();
      const randomNum = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");
      setReferenceNumber(`KHCWW-MEMO-${year}-${randomNum}`);
    },
    onError: (error: any) => {
      setSaving(false);
      toast.error(error.message);
    },
  });

  // Download PDF function — uses html2pdf for proper PDF generation (not just print)
  const downloadPDF = async () => {
    if (!previewRef.current) {
      toast.error("Preview not available");
      return;
    }
    const element = previewRef.current.querySelector(".bg-white") as HTMLElement | null;
    if (!element) {
      toast.error("Could not generate PDF");
      return;
    }
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const fileName = `${referenceNumber || "memo"}.pdf`;
      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: fileName,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["avoid-all", "css", "legacy"] },
        })
        .from(element)
        .save();
      toast.success("PDF downloaded");
    } catch (err: any) {
      toast.error(`Failed to download PDF: ${err.message}`);
    }
  };

  // Send notification function
  const sendNotification = async () => {
    try {
      if (!formData.title.trim() || !formData.content.trim()) {
        toast.error("Please fill in title and content");
        return;
      }

      // Get recipient IDs
      let recipientIds: string[] = [];
      if (formData.recipientType === "all_members") {
        recipientIds = members.map((m) => m.id);
      } else if (formData.recipientType === "executives_only") {
        recipientIds = executives.map((e) => e.id);
      } else {
        recipientIds = formData.selectedMembers;
      }

      if (recipientIds.length === 0) {
        toast.error("No recipients selected");
        return;
      }

      // Create notifications for each recipient
      const notifications = recipientIds.map((memberId) => ({
        member_id: memberId,
        title: formData.title,
        message: formData.content.substring(0, 200),
        type: "memo",
        reference_id: referenceNumber,
        read: false,
        created_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("notifications")
        .insert(notifications);

      if (error) throw error;

      toast.success(`Notification sent to ${recipientIds.length} members`);
    } catch (error: any) {
      toast.error(`Failed to send notification: ${error.message}`);
    }
  };

  // Share to welfare chat function
  const shareToWelfareChat = async () => {
    try {
      if (!formData.title.trim() || !formData.content.trim()) {
        toast.error("Please fill in title and content");
        return;
      }

      // Find or create welfare chat
      const { data: chats, error: chatError } = await supabase
        .from("chats")
        .select("id")
        .eq("name", "Welfare")
        .single();

      if (chatError && chatError.code !== "PGRST116") {
        throw chatError;
      }

      let chatId = chats?.id;

      // If welfare chat doesn't exist, create it
      if (!chatId) {
        const { data: newChat, error: createError } = await supabase
          .from("chats")
          .insert({
            name: "Welfare",
            description: "Welfare and treasurer communications",
            is_group: true,
            created_by: user?.id,
          })
          .select()
          .single();

        if (createError) throw createError;
        chatId = newChat.id;
      }

      // Send memo as message to welfare chat
      const messageContent = `📋 **${formData.title}**\n\n${formData.content}\n\n_Reference: ${referenceNumber}_`;

      const { error: messageError } = await supabase
        .from("messages")
        .insert({
          chat_id: chatId,
          user_id: user?.id,
          content: messageContent,
          message_type: "memo",
          created_at: new Date().toISOString(),
        });

      if (messageError) throw messageError;

      toast.success("Memo shared to Welfare chat");
    } catch (error: any) {
      toast.error(`Failed to share to chat: ${error.message}`);
    }
  };

  const renderLetterhead = () => {
    const orgName = orgSettings?.organization_name || "KIRINYAGA HEALTHCARE WORKERS' WELFARE";
    const orgAddress = orgSettings?.organization_address || "P.O.BOX 24-10300 KERUGOYA, LOCATION: KCRH";
    const orgEmail = orgSettings?.organization_email || "Khcww2020@gmail.com";
    const orgPhone = orgSettings?.organization_phone || "+254 712 345 678";

    return (
      <div className="bg-white" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
        {/* Header */}
        <div className="border-b-4 border-orange-500 pb-4 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-shrink-0">
              <img
                src={orgSettings?.logo_url || logoImage}
                alt="Organization Logo"
                className="h-20 w-20 object-contain"
              />
            </div>
            <div className="flex-1 text-right ml-4">
              <h1 className="text-lg font-bold text-[#111827] mb-1">
                {orgName}
              </h1>
              <div className="text-xs text-[#6B7280] space-y-0.5">
                <p>{orgAddress}</p>
                <p className="text-orange-600 font-medium">Email: {orgEmail}</p>
                <p>Tel: {orgPhone}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Watermark */}
        <div className="text-center mb-4">
          <p className="text-xs font-bold text-orange-500 tracking-widest">KHCWW OFFICIAL MEMO</p>
        </div>

        {/* Memo Content */}
        <div className="mb-8">
          <h2 className="text-base font-bold text-[#111827] mb-2">{formData.title || "Memo Title"}</h2>
          <div className="text-xs text-[#6B7280] space-y-1 mb-4">
            <p>Date: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
            <p>Reference: {referenceNumber}</p>
          </div>

          <div className="text-sm text-[#111827] leading-relaxed whitespace-pre-wrap mb-8">
            {formData.content || "Memo content will appear here..."}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t-2 border-[#E5E7EB]">
          <div className="flex justify-between items-end">
            <div>
              {orgSettings?.signature_url && (
                <div className="mb-2">
                  <img
                    src={orgSettings.signature_url}
                    alt="Treasurer Signature"
                    className="h-16 object-contain"
                  />
                </div>
              )}
              <div className="border-t-2 border-[#111827] pt-1 w-56">
                <p className="text-xs font-bold">Treasurer</p>
                <p className="text-xs text-[#6B7280] mt-1">Authorized by Treasurer</p>
              </div>
            </div>

            {orgSettings?.stamp_url && (
              <div className="flex-shrink-0">
                <img
                  src={orgSettings.stamp_url}
                  alt="Official Stamp"
                  className="h-24 w-24 object-contain opacity-90"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer Contact */}
        <div className="mt-8 pt-4 border-t border-[#E5E7EB] text-center">
          <div className="text-xs text-[#6B7280] space-y-0.5">
            <p className="font-semibold">{orgName}</p>
            <p>{orgAddress}</p>
            <p>Email: {orgEmail} | Tel: {orgPhone}</p>
          </div>
        </div>
      </div>
    );
  };

  const getCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      financial_notice: "Financial Notice",
      contribution_reminder: "Contribution Reminder",
      penalty_notice: "Penalty Notice",
      payout_notification: "Payout Notification",
      general_communication: "General Communication",
    };
    return labels[cat] || cat;
  };

  const getRecipientCount = () => {
    if (formData.recipientType === "all_members") return members.length;
    if (formData.recipientType === "executives_only") return executives.length;
    return formData.selectedMembers.length;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#111827]">Create Memo</h2>
        <p className="text-sm text-[#6B7280] mt-1">
          Create and send official memos with branded letterhead
        </p>
        {membersError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            ❌ Error loading members: {membersError.message}
          </div>
        )}
        {membersLoading && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
            ⏳ Loading members...
          </div>
        )}
        {!membersLoading && !membersError && members.length === 0 && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
            ⚠️ No members found. Check browser console for details.
          </div>
        )}
        {!membersLoading && !membersError && members.length > 0 && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
            ✅ Loaded {members.length} active members
          </div>
        )}
      </div>

      {/* Main Content - Split Screen */}
      <div className="grid grid-cols-2 gap-6">
        {/* LEFT SIDE - FORM */}
        <Card className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] h-fit">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-[#111827]">Memo Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Reference Number (Read-only) */}
            <div>
              <Label className="text-xs font-semibold text-[#6B7280]">Reference Number</Label>
              <Input
                value={referenceNumber}
                disabled
                className="bg-[#F9FAFB] text-[#6B7280]"
              />
              <p className="text-xs text-[#6B7280] mt-1">Auto-generated</p>
            </div>

            {/* Title */}
            <div>
              <Label className="text-xs font-semibold text-[#6B7280]">Memo Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Late Payment Reminder"
                className="border-[#E5E7EB]"
              />
            </div>

            {/* Category */}
            <div>
              <Label className="text-xs font-semibold text-[#6B7280]">Category *</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                <SelectTrigger className="border-[#E5E7EB]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="financial_notice">Financial Notice</SelectItem>
                  <SelectItem value="contribution_reminder">Contribution Reminder</SelectItem>
                  <SelectItem value="penalty_notice">Penalty Notice</SelectItem>
                  <SelectItem value="payout_notification">Payout Notification</SelectItem>
                  <SelectItem value="general_communication">General Communication</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Template Selection */}
            <div>
              <Label className="text-xs font-semibold text-[#6B7280]">Use Template (Optional)</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowTemplateSelector(true)}
                className="w-full justify-start"
              >
                <Plus className="h-3 w-3 mr-2" />
                Load Template
              </Button>
            </div>

            {/* Content with Rich Text Toolbar */}
            <div>
              <Label className="text-xs font-semibold text-[#6B7280]">Message Body *</Label>
              <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
                {/* Toolbar */}
                <div className="bg-[#F9FAFB] border-b border-[#E5E7EB] p-2 flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const textarea = document.getElementById("memo-content") as HTMLTextAreaElement;
                      if (textarea) {
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const selected = formData.content.substring(start, end);
                        const before = formData.content.substring(0, start);
                        const after = formData.content.substring(end);
                        setFormData({
                          ...formData,
                          content: `${before}**${selected}**${after}`,
                        });
                      }
                    }}
                    title="Bold"
                  >
                    <Bold className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const textarea = document.getElementById("memo-content") as HTMLTextAreaElement;
                      if (textarea) {
                        const start = textarea.selectionStart;
                        const before = formData.content.substring(0, start);
                        const after = formData.content.substring(start);
                        setFormData({
                          ...formData,
                          content: `${before}\n• ${after}`,
                        });
                      }
                    }}
                    title="Bullet List"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <div className="flex-1" />
                  <span className="text-xs text-[#6B7280] py-2 px-2">
                    {formData.content.length} characters
                  </span>
                </div>
                {/* Textarea */}
                <Textarea
                  id="memo-content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter memo content... Use **text** for bold, • for bullets"
                  rows={10}
                  className="border-0 font-['Times_New_Roman',_serif] rounded-none"
                />
              </div>
              <p className="text-xs text-[#6B7280] mt-1">
                Supports: **bold**, • bullets, clean formatting
              </p>
            </div>

            {/* Attachments */}
            <div>
              <Label className="text-xs font-semibold text-[#6B7280]">Attachments (Optional)</Label>
              <div className="border-2 border-dashed border-[#E5E7EB] rounded-lg p-4 text-center hover:border-orange-500 transition-colors cursor-pointer">
                <input
                  type="file"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      setAttachments(Array.from(e.target.files));
                    }
                  }}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <FileUp className="h-6 w-6 mx-auto mb-2 text-[#6B7280]" />
                  <p className="text-sm text-[#6B7280]">Click to upload files</p>
                  <p className="text-xs text-[#6B7280] mt-1">PDF, DOC, XLS supported</p>
                </label>
              </div>
              {attachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {attachments.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-[#F9FAFB] p-2 rounded text-sm">
                      <span className="text-[#111827]">{file.name}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recipient Type */}
            <div>
              <Label className="text-xs font-semibold text-[#6B7280]">Recipients *</Label>
              <Select
                value={formData.recipientType}
                onValueChange={(value) => setFormData({ ...formData, recipientType: value })}
              >
                <SelectTrigger className="border-[#E5E7EB]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_members">
                    All Members ({membersLoading ? "Loading..." : members.length})
                  </SelectItem>
                  <SelectItem value="executives_only">
                    Executives Only ({executivesLoading ? "Loading..." : executives.length})
                  </SelectItem>
                  <SelectItem value="custom_selection">Custom Selection</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Member Selection */}
            {formData.recipientType === "custom_selection" && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-semibold text-[#6B7280]">
                    Select Members ({formData.selectedMembers.length})
                  </Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowMemberSelector(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {formData.selectedMembers.map((memberId) => {
                    const member = members.find((m) => m.id === memberId);
                    return (
                      <div
                        key={memberId}
                        className="flex items-center justify-between bg-[#F9FAFB] p-2 rounded border border-[#E5E7EB]"
                      >
                        <span className="text-sm text-[#111827]">{member?.name}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              selectedMembers: formData.selectedMembers.filter((id) => id !== memberId),
                            })
                          }
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recipient Summary */}
            <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
              <p className="text-xs font-semibold text-orange-900 mb-1">Recipients</p>
              <p className="text-sm text-orange-800">
                {formData.recipientType === "all_members"
                  ? `All ${members.length} members`
                  : formData.recipientType === "executives_only"
                  ? `${executives.length} executives`
                  : `${formData.selectedMembers.length} selected members`}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => saveMemo.mutate(true)}
                disabled={saving}
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
              <Button
                onClick={() => saveMemo.mutate(false)}
                disabled={saving || !formData.title || !formData.content}
                className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
              >
                <Send className="h-4 w-4 mr-2" />
                {saving ? "Sending..." : "Send Memo"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* RIGHT SIDE - LIVE PREVIEW */}
        <div>
          <Card className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] sticky top-8">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-[#111827]">Live Preview</CardTitle>
              <p className="text-xs text-[#6B7280] mt-1">This is how your memo will look</p>
            </CardHeader>
            <CardContent>
              <div ref={previewRef} className="bg-[#F9FAFB] p-6 rounded-lg overflow-auto max-h-[600px] border border-[#E5E7EB]">
                <div className="bg-white p-8 rounded shadow-sm">
                  {renderLetterhead()}
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button 
                  onClick={downloadPDF}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
                <Button 
                  onClick={sendNotification}
                  variant="outline"
                  className="flex-1"
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Send Notification
                </Button>
              </div>
              <Button 
                onClick={shareToWelfareChat}
                variant="outline"
                className="w-full mt-2"
              >
                <Send className="h-4 w-4 mr-2" />
                Share to Welfare Chat
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Template Selector Dialog */}
      <Dialog open={showTemplateSelector} onOpenChange={setShowTemplateSelector}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Memo Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {templates.map((template: any) => (
              <div
                key={template.id}
                className="p-4 border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] cursor-pointer transition-colors"
                onClick={() => {
                  setFormData({
                    ...formData,
                    title: template.name,
                    category: template.category,
                    content: template.template_content,
                  });
                  setShowTemplateSelector(false);
                  toast.success("Template loaded successfully");
                }}
              >
                <p className="text-sm font-medium text-[#111827]">{template.name}</p>
                <p className="text-xs text-[#6B7280] mt-1">{template.template_content.substring(0, 100)}...</p>
                {template.variables && template.variables.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {template.variables.map((v: string) => (
                      <Badge key={v} variant="secondary" className="text-xs">
                        {v}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            onClick={() => setShowTemplateSelector(false)}
            className="w-full"
          >
            Cancel
          </Button>
        </DialogContent>
      </Dialog>

      {/* Member Selector Dialog */}
      <Dialog open={showMemberSelector} onOpenChange={setShowMemberSelector}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Members ({members.length} available)</DialogTitle>
          </DialogHeader>
          {membersLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12 text-[#6B7280]">
              <p>No active members found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-3 border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] cursor-pointer"
                  onClick={() => {
                    if (formData.selectedMembers.includes(member.id)) {
                      setFormData({
                        ...formData,
                        selectedMembers: formData.selectedMembers.filter((id) => id !== member.id),
                      });
                    } else {
                      setFormData({
                        ...formData,
                        selectedMembers: [...formData.selectedMembers, member.id],
                      });
                    }
                  }}
                >
                  <Checkbox
                    checked={formData.selectedMembers.includes(member.id)}
                    onCheckedChange={() => {}}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#111827]">{member.name}</p>
                    <p className="text-xs text-[#6B7280]">{member.phone || member.user_id || "No contact"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowMemberSelector(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={() => setShowMemberSelector(false)}
              className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
            >
              Done ({formData.selectedMembers.length} selected)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
