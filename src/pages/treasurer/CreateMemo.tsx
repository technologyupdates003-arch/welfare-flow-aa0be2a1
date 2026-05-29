import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
const supabase: any = supabaseClient;
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Save, Send, Download, Plus, X, Bold, List, FileUp, Bell, Eye, FileText, Users, Sparkles } from "lucide-react";
import { toast } from "sonner";
import logoImage from "@/assets/WhatsApp Image 2026-04-13 at 12.35.07.jpeg";

export default function CreateMemo() {
  const { user } = useAuth();
  const { id: editId } = useParams();
  const navigate = useNavigate();
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
  const [memberSearch, setMemberSearch] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);

  // Current treasurer's full name (for memo signature/authentication)
  const { data: treasurerName } = useQuery({
    queryKey: ["treasurer-name", user?.id],
    queryFn: async () => {
      if (!user?.id) return "";
      const { data } = await supabase.from("members").select("name").eq("user_id", user.id).maybeSingle();
      return data?.name || "";
    },
    enabled: !!user?.id,
  });

  const { data: orgSettings } = useQuery({
    queryKey: ["organization-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("organization_settings").select("*").single();
      return data;
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["memo-templates"],
    queryFn: async () => {
      const { data } = await supabase.from("memo_templates").select("*").order("name");
      return data || [];
    },
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["memo-members-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("*");
      if (error) {
        toast.error(`Failed to load members: ${error.message}`);
        return [];
      }
      return (data || []).filter((m: any) => m.is_active === true);
    },
    staleTime: 0,
  });

  const { data: executives = [], isLoading: executivesLoading } = useQuery({
    queryKey: ["memo-executives-list"],
    queryFn: async () => {
      const { data: roleRows } = await supabase.from("user_roles").select("user_id");
      const userIds = Array.from(new Set((roleRows || []).map((r: any) => r.user_id).filter(Boolean)));
      if (userIds.length === 0) return [];
      const { data: roleMembers } = await supabase
        .from("members")
        .select("id, name, phone, is_active, user_id")
        .in("user_id", userIds)
        .eq("is_active", true)
        .order("name");
      return roleMembers || [];
    },
    staleTime: 0,
  });

  useEffect(() => {
    const year = new Date().getFullYear();
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    setReferenceNumber(`KHCWW-MEMO-${year}-${randomNum}`);
  }, []);

  const saveMemo = useMutation({
    mutationFn: async (isDraft: boolean) => {
      if (!formData.title.trim()) throw new Error("Memo title is required");
      if (!formData.content.trim()) throw new Error("Memo content is required");
      if (formData.recipientType === "custom_selection" && formData.selectedMembers.length === 0)
        throw new Error("Please select at least one member");

      setSaving(true);
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

      let recipientIds: string[] = [];
      if (formData.recipientType === "all_members") recipientIds = members.map((m: any) => m.id);
      else if (formData.recipientType === "executives_only") recipientIds = executives.map((e: any) => e.id);
      else recipientIds = formData.selectedMembers;

      if (recipientIds.length > 0) {
        const recipientRecords = recipientIds.map((memberId) => ({
          memo_id: memoData.id,
          member_id: memberId,
          delivered_at: isDraft ? null : new Date().toISOString(),
        }));
        const { error: recipientError } = await supabase.from("memo_recipients").insert(recipientRecords);
        if (recipientError) throw recipientError;
      }
      setSaving(false);
      return memoData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["memos"] });
      toast.success(data.status === "draft" ? "Memo saved as draft" : "Memo sent successfully");
      setFormData({
        title: "",
        category: "general_communication",
        content: "",
        recipientType: "all_members",
        selectedMembers: [],
      });
      const year = new Date().getFullYear();
      const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
      setReferenceNumber(`KHCWW-MEMO-${year}-${randomNum}`);
    },
    onError: (error: any) => {
      setSaving(false);
      toast.error(error.message);
    },
  });

  const downloadPDF = async () => {
    if (!previewRef.current) return toast.error("Preview not available");
    const element = previewRef.current.querySelector(".memo-printable") as HTMLElement | null;
    if (!element) return toast.error("Could not generate PDF");
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      await (html2pdf as any)()
        .set({
          margin: [10, 10, 10, 10],
          filename: `${referenceNumber || "memo"}.pdf`,
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

  const sendNotification = async () => {
    try {
      if (!formData.title.trim() || !formData.content.trim())
        return toast.error("Please fill in title and content");
      let recipientIds: string[] = [];
      if (formData.recipientType === "all_members") recipientIds = members.map((m: any) => m.id);
      else if (formData.recipientType === "executives_only") recipientIds = executives.map((e: any) => e.id);
      else recipientIds = formData.selectedMembers;
      if (recipientIds.length === 0) return toast.error("No recipients selected");

      const notifications = recipientIds.map((memberId) => ({
        member_id: memberId,
        title: formData.title,
        message: formData.content.substring(0, 200),
        type: "memo",
        reference_id: referenceNumber,
        read: false,
        created_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from("notifications").insert(notifications);
      if (error) throw error;
      toast.success(`Notification sent to ${recipientIds.length} members`);
    } catch (error: any) {
      toast.error(`Failed: ${error.message}`);
    }
  };

  const shareToWelfareChat = async () => {
    try {
      if (!formData.title.trim() || !formData.content.trim())
        return toast.error("Please fill in title and content");
      const { data: chats, error: chatError } = await supabase
        .from("chats").select("id").eq("name", "Welfare").single();
      if (chatError && chatError.code !== "PGRST116") throw chatError;
      let chatId = chats?.id;
      if (!chatId) {
        const { data: newChat, error: createError } = await supabase
          .from("chats")
          .insert({ name: "Welfare", description: "Welfare and treasurer communications", is_group: true, created_by: user?.id })
          .select().single();
        if (createError) throw createError;
        chatId = newChat.id;
      }
      const messageContent = `📋 **${formData.title}**\n\n${formData.content}\n\n_Reference: ${referenceNumber}_`;
      const { error: messageError } = await supabase
        .from("messages")
        .insert({ chat_id: chatId, user_id: user?.id, content: messageContent, message_type: "memo", created_at: new Date().toISOString() });
      if (messageError) throw messageError;
      toast.success("Memo shared to Welfare chat");
    } catch (error: any) {
      toast.error(`Failed to share: ${error.message}`);
    }
  };

  const renderLetterhead = () => {
    const orgName = orgSettings?.organization_name || "KIRINYAGA HEALTHCARE WORKERS' WELFARE";
    const orgAddress = orgSettings?.organization_address || "P.O.BOX 24-10300 KERUGOYA, LOCATION: KCRH";
    const orgEmail = orgSettings?.organization_email || "Khcww2020@gmail.com";
    const orgPhone = orgSettings?.organization_phone || "+254 712 345 678";

    return (
      <div className="memo-printable bg-white text-[#111827]" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
        <div className="border-b-4 border-orange-500 pb-3 sm:pb-4 mb-4 sm:mb-6">
          <div className="flex items-start justify-between gap-3">
            <img src={orgSettings?.logo_url || logoImage} alt="Logo" className="h-14 w-14 sm:h-20 sm:w-20 object-contain shrink-0" />
            <div className="flex-1 text-right">
              <h1 className="text-sm sm:text-lg font-bold mb-1 leading-tight">{orgName}</h1>
              <div className="text-[10px] sm:text-xs text-[#6B7280] space-y-0.5">
                <p>{orgAddress}</p>
                <p className="text-orange-600 font-medium break-all">Email: {orgEmail}</p>
                <p>Tel: {orgPhone}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mb-4">
          <p className="text-[10px] sm:text-xs font-bold text-orange-500 tracking-widest">KHCWW OFFICIAL MEMO</p>
        </div>

        <div className="mb-6 sm:mb-8">
          <h2 className="text-sm sm:text-base font-bold mb-2">{formData.title || "Memo Title"}</h2>
          <div className="text-[10px] sm:text-xs text-[#6B7280] space-y-1 mb-4">
            <p>Date: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
            <p className="break-all">Reference: {referenceNumber}</p>
          </div>
          <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
            {formData.content || "Memo content will appear here..."}
          </div>
        </div>

        <div className="mt-10 sm:mt-12 pt-4 sm:pt-6 border-t-2 border-[#E5E7EB]">
          <div className="flex justify-between items-end gap-3">
            <div>
              {orgSettings?.signature_url && (
                <img src={orgSettings.signature_url} alt="Treasurer Signature" className="h-12 sm:h-16 object-contain mb-2" />
              )}
              <div className="border-t-2 border-[#111827] pt-1 w-40 sm:w-56">
                <p className="text-[10px] sm:text-xs font-bold">Treasurer</p>
                <p className="text-[10px] sm:text-xs text-[#6B7280] mt-1">Authorized by Treasurer</p>
              </div>
            </div>
            {orgSettings?.stamp_url && (
              <img src={orgSettings.stamp_url} alt="Stamp" className="h-16 w-16 sm:h-24 sm:w-24 object-contain opacity-90 shrink-0" />
            )}
          </div>
        </div>

        <div className="mt-6 sm:mt-8 pt-4 border-t border-[#E5E7EB] text-center">
          <div className="text-[10px] sm:text-xs text-[#6B7280] space-y-0.5">
            <p className="font-semibold">{orgName}</p>
            <p>{orgAddress}</p>
            <p className="break-all">Email: {orgEmail} | Tel: {orgPhone}</p>
          </div>
        </div>
      </div>
    );
  };

  const filteredMembersForSelector = members.filter((m: any) =>
    m.name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.phone?.includes(memberSearch)
  );

  const recipientCount =
    formData.recipientType === "all_members" ? members.length :
    formData.recipientType === "executives_only" ? executives.length :
    formData.selectedMembers.length;

  return (
    <div className="space-y-4 sm:space-y-6 pb-32 lg:pb-6">
      {/* Header */}
      <div className="glass rounded-2xl p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl gradient-brand flex items-center justify-center shadow-brand shrink-0">
            <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-gradient-brand truncate">Create Memo</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Branded letterhead with live preview</p>
          </div>
        </div>
      </div>

      {/* Mobile tabs / Desktop split */}
      <Tabs defaultValue="form" className="lg:hidden">
        <TabsList className="grid grid-cols-2 w-full glass">
          <TabsTrigger value="form" className="data-[state=active]:gradient-brand data-[state=active]:text-primary-foreground">
            <FileText className="h-4 w-4 mr-1.5" /> Editor
          </TabsTrigger>
          <TabsTrigger value="preview" className="data-[state=active]:gradient-brand data-[state=active]:text-primary-foreground">
            <Eye className="h-4 w-4 mr-1.5" /> Preview
          </TabsTrigger>
        </TabsList>
        <TabsContent value="form" className="mt-4">
          <FormCard
            formData={formData} setFormData={setFormData}
            referenceNumber={referenceNumber}
            members={members} executives={executives}
            membersLoading={membersLoading} executivesLoading={executivesLoading}
            attachments={attachments} setAttachments={setAttachments}
            onPickTemplate={() => setShowTemplateSelector(true)}
            onPickMembers={() => setShowMemberSelector(true)}
          />
        </TabsContent>
        <TabsContent value="preview" className="mt-4">
          <PreviewCard previewRef={previewRef} renderLetterhead={renderLetterhead} />
        </TabsContent>
      </Tabs>

      {/* Desktop split */}
      <div className="hidden lg:grid grid-cols-2 gap-6">
        <FormCard
          formData={formData} setFormData={setFormData}
          referenceNumber={referenceNumber}
          members={members} executives={executives}
          membersLoading={membersLoading} executivesLoading={executivesLoading}
          attachments={attachments} setAttachments={setAttachments}
          onPickTemplate={() => setShowTemplateSelector(true)}
          onPickMembers={() => setShowMemberSelector(true)}
        />
        <div>
          <PreviewCard previewRef={previewRef} renderLetterhead={renderLetterhead} sticky />
        </div>
      </div>

      {/* Sticky mobile action bar */}
      <div className="fixed bottom-0 inset-x-0 lg:hidden z-40 glass-strong border-t border-border/60 px-3 py-3 pb-safe">
        <div className="flex items-center gap-2 mb-2">
          <Badge className="glass-brand text-primary border-primary/30 text-[11px]">
            <Users className="h-3 w-3 mr-1" /> {recipientCount} recipients
          </Badge>
          <Badge variant="outline" className="text-[11px] truncate max-w-[160px]">{referenceNumber}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => saveMemo.mutate(true)} disabled={saving} size="sm">
            <Save className="h-4 w-4 mr-1.5" /> Draft
          </Button>
          <Button onClick={() => saveMemo.mutate(false)} disabled={saving || !formData.title || !formData.content} size="sm" className="gradient-brand text-primary-foreground shadow-brand">
            <Send className="h-4 w-4 mr-1.5" /> {saving ? "Sending…" : "Send"}
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <Button onClick={downloadPDF} variant="ghost" size="sm" className="text-xs"><Download className="h-3.5 w-3.5 mr-1" /> PDF</Button>
          <Button onClick={sendNotification} variant="ghost" size="sm" className="text-xs"><Bell className="h-3.5 w-3.5 mr-1" /> Notify</Button>
          <Button onClick={shareToWelfareChat} variant="ghost" size="sm" className="text-xs"><Sparkles className="h-3.5 w-3.5 mr-1" /> Chat</Button>
        </div>
      </div>

      {/* Desktop action bar */}
      <div className="hidden lg:flex flex-wrap gap-2 justify-end">
        <Button variant="outline" onClick={() => saveMemo.mutate(true)} disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> Save Draft
        </Button>
        <Button onClick={downloadPDF} variant="outline">
          <Download className="h-4 w-4 mr-2" /> Download PDF
        </Button>
        <Button onClick={sendNotification} variant="outline">
          <Bell className="h-4 w-4 mr-2" /> Notify
        </Button>
        <Button onClick={shareToWelfareChat} variant="outline">
          <Sparkles className="h-4 w-4 mr-2" /> Share to Chat
        </Button>
        <Button onClick={() => saveMemo.mutate(false)} disabled={saving || !formData.title || !formData.content} className="gradient-brand text-primary-foreground shadow-brand">
          <Send className="h-4 w-4 mr-2" /> {saving ? "Sending…" : "Send Memo"}
        </Button>
      </div>

      {/* Template Selector */}
      <Dialog open={showTemplateSelector} onOpenChange={setShowTemplateSelector}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto glass-strong">
          <DialogHeader><DialogTitle>Select Memo Template</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {templates.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No templates available</p>}
            {templates.map((template: any) => (
              <button
                key={template.id}
                className="w-full text-left p-3 sm:p-4 rounded-xl glass hover:glass-brand transition-all"
                onClick={() => {
                  setFormData({ ...formData, title: template.name, category: template.category, content: template.template_content });
                  setShowTemplateSelector(false);
                  toast.success("Template loaded");
                }}
              >
                <p className="text-sm font-semibold">{template.name}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.template_content}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Member Selector */}
      <Dialog open={showMemberSelector} onOpenChange={setShowMemberSelector}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col glass-strong">
          <DialogHeader><DialogTitle>Select Members ({members.length} available)</DialogTitle></DialogHeader>
          <Input placeholder="Search by name or phone…" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} />
          <div className="overflow-y-auto flex-1 space-y-1.5 -mx-1 px-1">
            {membersLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredMembersForSelector.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground text-sm">No members</p>
            ) : (
              filteredMembersForSelector.map((member: any) => {
                const checked = formData.selectedMembers.includes(member.id);
                return (
                  <div
                    key={member.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${checked ? "glass-brand border-primary/30" : "glass-subtle hover:glass border-border/60"}`}
                    onClick={() => {
                      setFormData({
                        ...formData,
                        selectedMembers: checked
                          ? formData.selectedMembers.filter((id) => id !== member.id)
                          : [...formData.selectedMembers, member.id],
                      });
                    }}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => {}} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{member.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.phone}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <Button onClick={() => setShowMemberSelector(false)} className="gradient-brand text-primary-foreground">
            Done ({formData.selectedMembers.length} selected)
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Subcomponents ---------- */

function FormCard({
  formData, setFormData, referenceNumber, members, executives,
  membersLoading, executivesLoading, attachments, setAttachments,
  onPickTemplate, onPickMembers,
}: any) {
  return (
    <Card className="glass-strong border-white/40 rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg font-bold">Memo Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Reference Number</Label>
          <Input value={referenceNumber} disabled className="bg-muted/40 mt-1" />
        </div>

        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Memo Title *</Label>
          <Input
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g., Late Payment Reminder"
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Category *</Label>
          <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="financial_notice">Financial Notice</SelectItem>
              <SelectItem value="contribution_reminder">Contribution Reminder</SelectItem>
              <SelectItem value="penalty_notice">Penalty Notice</SelectItem>
              <SelectItem value="payout_notification">Payout Notification</SelectItem>
              <SelectItem value="general_communication">General Communication</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button size="sm" variant="outline" onClick={onPickTemplate} className="w-full">
          <Plus className="h-3.5 w-3.5 mr-2" /> Load Template
        </Button>

        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Message Body *</Label>
          <div className="border border-border rounded-xl overflow-hidden mt-1 bg-card">
            <div className="bg-muted/40 border-b border-border p-1.5 flex gap-1 items-center">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
                const ta = document.getElementById("memo-content") as HTMLTextAreaElement;
                if (!ta) return;
                const start = ta.selectionStart, end = ta.selectionEnd;
                const sel = formData.content.substring(start, end);
                setFormData({ ...formData, content: formData.content.substring(0, start) + `**${sel}**` + formData.content.substring(end) });
              }}>
                <Bold className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
                const ta = document.getElementById("memo-content") as HTMLTextAreaElement;
                if (!ta) return;
                const start = ta.selectionStart;
                setFormData({ ...formData, content: formData.content.substring(0, start) + "\n• " + formData.content.substring(start) });
              }}>
                <List className="h-3.5 w-3.5" />
              </Button>
              <span className="ml-auto text-[10px] text-muted-foreground pr-2">{formData.content.length} chars</span>
            </div>
            <Textarea
              id="memo-content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Use **text** for bold, • for bullets…"
              rows={8}
              className="border-0 rounded-none focus-visible:ring-0 resize-y"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Attachments</Label>
          <label htmlFor="file-upload" className="block mt-1 cursor-pointer">
            <div className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-primary/60 hover:bg-primary/5 transition-all">
              <FileUp className="h-5 w-5 mx-auto mb-1.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Tap to upload (PDF, DOC, XLS)</p>
            </div>
            <input id="file-upload" type="file" multiple onChange={(e) => e.target.files && setAttachments(Array.from(e.target.files))} className="hidden" />
          </label>
          {attachments.length > 0 && (
            <div className="mt-2 space-y-1">
              {attachments.map((file: File, idx: number) => (
                <div key={idx} className="flex items-center justify-between glass-subtle p-2 rounded-lg text-xs">
                  <span className="truncate flex-1">{file.name}</span>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setAttachments(attachments.filter((_: any, i: number) => i !== idx))}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <Label className="text-xs font-semibold text-muted-foreground">Recipients *</Label>
          <Select value={formData.recipientType} onValueChange={(value) => setFormData({ ...formData, recipientType: value })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all_members">All Members ({membersLoading ? "…" : members.length})</SelectItem>
              <SelectItem value="executives_only">Executives Only ({executivesLoading ? "…" : executives.length})</SelectItem>
              <SelectItem value="custom_selection">Custom Selection</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {formData.recipientType === "custom_selection" && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold text-muted-foreground">Selected ({formData.selectedMembers.length})</Label>
              <Button size="sm" variant="outline" onClick={onPickMembers}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {formData.selectedMembers.map((memberId: string) => {
                const member = members.find((m: any) => m.id === memberId);
                return (
                  <div key={memberId} className="flex items-center justify-between glass-subtle p-2 rounded-lg text-sm">
                    <span className="truncate flex-1">{member?.name || "—"}</span>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() =>
                      setFormData({ ...formData, selectedMembers: formData.selectedMembers.filter((id: string) => id !== memberId) })
                    }>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="glass-brand rounded-xl p-3">
          <p className="text-[11px] font-semibold text-primary uppercase tracking-wider">Sending To</p>
          <p className="text-sm font-medium mt-0.5">
            {formData.recipientType === "all_members" ? `All ${members.length} members`
              : formData.recipientType === "executives_only" ? `${executives.length} executives`
              : `${formData.selectedMembers.length} selected`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function PreviewCard({ previewRef, renderLetterhead, sticky }: any) {
  return (
    <Card className={`glass-strong border-white/40 rounded-2xl ${sticky ? "sticky top-20" : ""}`}>
      <CardHeader className="pb-3 flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base sm:text-lg font-bold">Live Preview</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">A4 letterhead view</p>
        </div>
        <Eye className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        <div ref={previewRef} className="bg-muted/30 p-2 sm:p-4 rounded-xl overflow-auto max-h-[60vh] sm:max-h-[70vh] border border-border/60">
          <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm">
            {renderLetterhead()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
