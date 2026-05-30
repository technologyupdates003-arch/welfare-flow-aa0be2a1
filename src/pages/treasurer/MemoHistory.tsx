import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
const supabase: any = supabaseClient;
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Download, RotateCcw, Trash2, Search, Plus, FileText, Users, CheckCheck, Mail, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import logoImage from "@/assets/WhatsApp Image 2026-04-13 at 12.35.07.jpeg";


export default function MemoHistory() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMemo, setSelectedMemo] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "sent" | "draft">("all");

  const { data: treasurerName } = useQuery({
    queryKey: ["treasurer-name", user?.id],
    queryFn: async () => {
      if (!user?.id) return "";
      const { data } = await supabase.from("members").select("name").eq("user_id", user.id).maybeSingle();
      return data?.name || "";
    },
    enabled: !!user?.id,
  });

  const { data: memos = [], isLoading } = useQuery({
    queryKey: ["memos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("memos")
        .select(`*, memo_recipients ( id, delivered_at, seen_at, downloaded_at, members (name) )`)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: orgSettings } = useQuery({
    queryKey: ["organization-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("organization_settings").select("*").single();
      return data;
    },
  });

  const deleteMemo = useMutation({
    mutationFn: async (memoId: string) => {
      const { error } = await supabase.from("memos").delete().eq("id", memoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memos"] });
      toast.success("Memo deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resendMemo = useMutation({
    mutationFn: async (memoId: string) => {
      const { error } = await supabase.from("memos").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", memoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memos"] });
      toast.success("Memo resent");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const downloadMemoPDF = async (memo: any) => {
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const orgName = orgSettings?.organization_name || "KIRINYAGA HEALTHCARE WORKERS' WELFARE";
      const orgAddress = orgSettings?.organization_address || "P.O.BOX 24-10300 KERUGOYA, LOCATION: KCRH";
      const orgEmail = orgSettings?.organization_email || "Khcww2020@gmail.com";
      const orgPhone = orgSettings?.organization_phone || "+254 712 345 678";
      const signatureHtml = orgSettings?.signature_url ? `<div style="margin-bottom:6px;"><img src="${orgSettings.signature_url}" style="max-height:70px;display:block;"/></div>` : "";
      const stampHtml = orgSettings?.stamp_url ? `<div style="margin-top:0;max-width:120px;"><img src="${orgSettings.stamp_url}" style="max-height:120px;display:block;"/></div>` : "";
      const logoUrl = orgSettings?.logo_url || logoImage;
      const logoHtml = `<img src="${logoUrl}" style="height:72px;width:72px;object-fit:contain;" crossorigin="anonymous" />`;

      const container = document.createElement("div");
      container.style.padding = "24px";
      container.style.fontFamily = "'Times New Roman', Times, serif";
      container.style.background = "#ffffff";
      container.innerHTML = `
        <div style="border-bottom:4px solid #f97316;padding-bottom:12px;margin-bottom:18px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
          ${logoHtml}
          <div style="text-align:right;">
            <h1 style="margin:0;font-size:18px;font-weight:bold;color:#111827;">${orgName}</h1>
            <p style="margin:4px 0 0;font-size:11px;color:#6b7280;">${orgAddress}</p>
            <p style="margin:2px 0 0;font-size:11px;color:#f97316;font-weight:600;">Email: ${orgEmail}</p>
            <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">Tel: ${orgPhone}</p>
          </div>
        </div>
        <p style="text-align:center;font-size:11px;font-weight:bold;color:#f97316;letter-spacing:3px;margin:0 0 16px;">KHCWW OFFICIAL MEMO</p>
        <h2 style="font-size:15px;font-weight:bold;color:#111827;margin:0 0 6px;">${memo.title || ""}</h2>
        <div style="font-size:11px;color:#6b7280;margin-bottom:14px;">
          <p style="margin:2px 0;">Date: ${memo.sent_at ? new Date(memo.sent_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : new Date(memo.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
          <p style="margin:2px 0;">Reference: ${memo.reference_number || ""}</p>
          <p style="margin:2px 0;">Category: ${getCategoryLabel(memo.category)}</p>
        </div>
        <div style="font-size:13px;color:#111827;line-height:1.6;white-space:pre-wrap;">${(memo.content || "").replace(/</g, "&lt;")}</div>
        <div style="margin-top:48px;padding-top:14px;border-top:2px solid #111827;display:flex;justify-content:space-between;align-items:flex-end;gap:18px;">
          <div style="max-width:240px;">
            ${signatureHtml}
            <div style="border-top:2px solid #111827;padding-top:4px;width:220px;">
              ${treasurerName ? `<p style="margin:0;font-size:11px;font-weight:bold;">${treasurerName}</p>` : ""}
              <p style="margin:0;font-size:11px;font-weight:bold;">Treasurer</p>
              <p style="margin:4px 0 0;font-size:10px;color:#6b7280;">Authorized by Treasurer</p>
            </div>
          </div>
          ${stampHtml}
        </div>
        <div style="margin-top:20px;text-align:center;font-size:9px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:10px;">
          <div style="font-weight:bold;">${orgName}</div>
          <div>${orgAddress}</div>
          <div>Email: ${orgEmail} | Tel: ${orgPhone}</div>
        </div>
      `;
      document.body.appendChild(container);
      await html2pdf().set({
        margin: [10, 10, 10, 10],
        filename: `${memo.reference_number || memo.id}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      }).from(container).save();
      document.body.removeChild(container);
      await supabase.from("memo_recipients").update({ downloaded_at: new Date().toISOString() }).eq("memo_id", memo.id).is("downloaded_at", null);
      toast.success("PDF downloaded");
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    }
  };

  const getCategoryLabel = (cat: string) => ({
    financial_notice: "Financial Notice",
    contribution_reminder: "Contribution Reminder",
    penalty_notice: "Penalty Notice",
    payout_notification: "Payout Notification",
    general_communication: "General Communication",
  } as Record<string, string>)[cat] || cat;

  const getRecipientStats = (memo: any) => {
    const r = memo.memo_recipients || [];
    return {
      total: r.length,
      delivered: r.filter((x: any) => x.delivered_at).length,
      seen: r.filter((x: any) => x.seen_at).length,
      downloaded: r.filter((x: any) => x.downloaded_at).length,
    };
  };

  const filteredMemos = memos
    .filter((m: any) => filter === "all" || m.status === filter)
    .filter((m: any) =>
      m.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.reference_number?.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const sentCount = memos.filter((m: any) => m.status === "sent").length;
  const draftCount = memos.filter((m: any) => m.status === "draft").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="glass rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl gradient-brand flex items-center justify-center shadow-brand shrink-0">
            <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-gradient-brand truncate">Memo History</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Track every memo from draft to delivery</p>
          </div>
        </div>
        <Button onClick={() => navigate("/treasurer/memos/create")} size="sm" className="gradient-brand text-primary-foreground shadow-brand shrink-0">
          <Plus className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">Create</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: "Total", value: memos.length, icon: FileText },
          { label: "Sent", value: sentCount, icon: CheckCheck },
          { label: "Drafts", value: draftCount, icon: Mail },
        ].map((s, i) => (
          <Card key={i} className="glass border-white/40 rounded-2xl">
            <CardContent className="p-3 sm:p-4 text-center">
              <s.icon className="h-4 w-4 mx-auto text-primary mb-1" />
              <div className="text-xl sm:text-2xl font-bold">{s.value}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter pills + search */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search title or reference…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 glass border-border/60" />
        </div>
        <div className="flex gap-1.5 glass rounded-xl p-1">
          {(["all", "sent", "draft"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "ghost"}
              onClick={() => setFilter(f)}
              className={`flex-1 sm:flex-none capitalize text-xs ${filter === f ? "gradient-brand text-primary-foreground" : ""}`}
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      {/* Memos list */}
      {filteredMemos.length === 0 ? (
        <Card className="glass border-white/40 rounded-2xl">
          <CardContent className="text-center py-12 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No memos found</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid gap-3 sm:hidden">
            {filteredMemos.map((memo: any) => {
              const stats = getRecipientStats(memo);
              return (
                <Card key={memo.id} className="glass border-white/40 rounded-2xl overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-muted-foreground font-mono truncate">{memo.reference_number}</p>
                        <h3 className="font-semibold text-sm leading-snug mt-0.5 line-clamp-2">{memo.title}</h3>
                      </div>
                      {memo.status === "draft"
                        ? <Badge variant="secondary" className="text-[10px] shrink-0">Draft</Badge>
                        : <Badge className="bg-success/15 text-success border border-success/30 text-[10px] shrink-0">Sent</Badge>}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{getCategoryLabel(memo.category)}</Badge>
                      <span>{memo.sent_at ? new Date(memo.sent_at).toLocaleDateString() : "—"}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 glass-subtle rounded-lg p-2 text-center">
                      <div><div className="text-sm font-bold">{stats.delivered}/{stats.total}</div><div className="text-[9px] text-muted-foreground uppercase">Delivered</div></div>
                      <div><div className="text-sm font-bold text-success">{stats.seen}</div><div className="text-[9px] text-muted-foreground uppercase">Seen</div></div>
                      <div><div className="text-sm font-bold text-primary">{stats.downloaded}</div><div className="text-[9px] text-muted-foreground uppercase">Downloads</div></div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => { setSelectedMemo(memo); setPreviewOpen(true); }}>
                        <Eye className="h-3 w-3 mr-1" /> View
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => downloadMemoPDF(memo)}>
                        <Download className="h-3 w-3 mr-1" /> PDF
                      </Button>
                      {memo.status === "sent" && (
                        <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => resendMemo.mutate(memo.id)}>
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      )}
                      {memo.status === "draft" && (
                        <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => navigate(`/treasurer/memos/${memo.id}/edit`)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                      {memo.status === "draft" && (
                        <Button size="sm" variant="outline" className="h-8 px-2 text-destructive" onClick={() => deleteMemo.mutate(memo.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop table */}
          <Card className="hidden sm:block glass-strong border-white/40 rounded-2xl">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/60">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reference</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Title</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tracking</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMemos.map((memo: any) => {
                      const stats = getRecipientStats(memo);
                      return (
                        <tr key={memo.id} className="border-b border-border/40 last:border-0 hover:bg-primary/5 transition-colors">
                          <td className="py-3 px-4"><p className="text-xs font-mono">{memo.reference_number}</p></td>
                          <td className="py-3 px-4"><p className="text-sm font-medium">{memo.title}</p></td>
                          <td className="py-3 px-4"><Badge variant="outline" className="text-xs">{getCategoryLabel(memo.category)}</Badge></td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">{memo.sent_at ? new Date(memo.sent_at).toLocaleDateString() : "—"}</td>
                          <td className="py-3 px-4 text-center">
                            {memo.status === "draft"
                              ? <Badge variant="secondary">Draft</Badge>
                              : <Badge className="bg-success/15 text-success border border-success/30">Sent</Badge>}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-3 text-xs">
                              <span className="text-muted-foreground"><Users className="h-3 w-3 inline mr-0.5" />{stats.delivered}/{stats.total}</span>
                              <span className="text-success font-semibold">{stats.seen}</span>
                              <span className="text-primary font-semibold">{stats.downloaded}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1">
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setSelectedMemo(memo); setPreviewOpen(true); }} title="View"><Eye className="h-4 w-4" /></Button>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Download" onClick={() => downloadMemoPDF(memo)}><Download className="h-4 w-4" /></Button>
                              {memo.status === "sent" && <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => resendMemo.mutate(memo.id)} title="Resend"><RotateCcw className="h-4 w-4" /></Button>}
                              {memo.status === "draft" && <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => navigate(`/treasurer/memos/${memo.id}/edit`)} title="Edit"><Pencil className="h-4 w-4" /></Button>}
                              {memo.status === "draft" && <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => deleteMemo.mutate(memo.id)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto glass-strong">
          <DialogHeader><DialogTitle className="pr-6 line-clamp-2">{selectedMemo?.title}</DialogTitle></DialogHeader>
          {selectedMemo && (() => {
            const orgName = orgSettings?.organization_name || "KIRINYAGA HEALTHCARE WORKERS' WELFARE";
            const orgAddress = orgSettings?.organization_address || "P.O.BOX 24-10300 KERUGOYA, LOCATION: KCRH";
            const orgEmail = orgSettings?.organization_email || "Khcww2020@gmail.com";
            const orgPhone = orgSettings?.organization_phone || "+254 712 345 678";
            const memoDate = selectedMemo.sent_at || selectedMemo.created_at;
            return (
            <div className="space-y-4">
              {/* Full branded letterhead — same as memo template */}
              <div className="bg-white text-[#111827] rounded-xl p-5 sm:p-7 shadow-sm border border-border/40" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
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
                  <h2 className="text-sm sm:text-base font-bold mb-2">{selectedMemo.title}</h2>
                  <div className="text-[10px] sm:text-xs text-[#6B7280] space-y-1 mb-4">
                    <p>Date: {new Date(memoDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
                    <p className="break-all">Reference: {selectedMemo.reference_number}</p>
                    <p>Category: {getCategoryLabel(selectedMemo.category)}</p>
                  </div>
                  <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">{selectedMemo.content}</div>
                </div>

                <div className="mt-10 sm:mt-12 pt-4 sm:pt-6 border-t-2 border-[#E5E7EB]">
                  <div className="flex justify-between items-end gap-3">
                    <div>
                      {orgSettings?.signature_url && (
                        <img src={orgSettings.signature_url} alt="Treasurer Signature" className="h-12 sm:h-16 object-contain mb-2" />
                      )}
                      <div className="border-t-2 border-[#111827] pt-1 w-40 sm:w-56">
                        {treasurerName && <p className="text-[10px] sm:text-xs font-bold">{treasurerName}</p>}
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

              {selectedMemo.memo_recipients?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recipients ({selectedMemo.memo_recipients.length})</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {selectedMemo.memo_recipients.map((r: any) => (
                      <div key={r.id} className="flex items-center justify-between glass-subtle p-2 rounded-lg text-sm">
                        <span className="truncate flex-1">{r.members?.name || "—"}</span>
                        <div className="flex gap-1 shrink-0">
                          {r.delivered_at && <Badge className="bg-blue-500/15 text-blue-700 border border-blue-500/30 text-[9px]">Delivered</Badge>}
                          {r.seen_at && <Badge className="bg-success/15 text-success border border-success/30 text-[9px]">Seen</Badge>}
                          {r.downloaded_at && <Badge className="bg-primary/15 text-primary border border-primary/30 text-[9px]">Downloaded</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button onClick={() => downloadMemoPDF(selectedMemo)} className="w-full gradient-brand text-primary-foreground">
                <Download className="h-4 w-4 mr-2" /> Download PDF
              </Button>
            </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
