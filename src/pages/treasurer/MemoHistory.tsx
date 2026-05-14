import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
const supabase: any = supabaseClient;
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Download, RotateCcw, Trash2, Search, Plus } from "lucide-react";
import { toast } from "sonner";

export default function MemoHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMemo, setSelectedMemo] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Fetch all memos
  const { data: memos = [], isLoading } = useQuery({
    queryKey: ["memos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("memos")
        .select(`
          *,
          memo_recipients (
            id,
            delivered_at,
            seen_at,
            downloaded_at,
            members (name, email)
          )
        `)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

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

  // Delete memo mutation
  const deleteMemo = useMutation({
    mutationFn: async (memoId: string) => {
      const { error } = await supabase
        .from("memos")
        .delete()
        .eq("id", memoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memos"] });
      toast.success("Memo deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Resend memo mutation
  const resendMemo = useMutation({
    mutationFn: async (memoId: string) => {
      const { error } = await supabase
        .from("memos")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .eq("id", memoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memos"] });
      toast.success("Memo resent successfully");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Download memo as PDF
  const downloadMemoPDF = async (memo: any) => {
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const orgName = orgSettings?.organization_name || "KIRINYAGA HEALTHCARE WORKERS' WELFARE";
      const orgAddress = orgSettings?.organization_address || "P.O.BOX 24-10300 KERUGOYA, LOCATION: KCRH";
      const orgEmail = orgSettings?.organization_email || "Khcww2020@gmail.com";
      const orgPhone = orgSettings?.organization_phone || "+254 712 345 678";
      const signatureHtml = orgSettings?.signature_url ? `<div style="margin-top:16px;"><img src="${orgSettings.signature_url}" alt="Treasurer Signature" style="max-height:120px;display:block;"/></div>` : "";
      const stampHtml = orgSettings?.stamp_url ? `<div style="margin-top:0;max-width:120px;"><img src="${orgSettings.stamp_url}" alt="Official Stamp" style="max-height:120px;display:block;"/></div>` : "";

      const container = document.createElement("div");
      container.style.padding = "24px";
      container.style.fontFamily = "'Times New Roman', Times, serif";
      container.style.background = "#ffffff";
      container.innerHTML = `
        <div style="border-bottom:4px solid #f97316;padding-bottom:12px;margin-bottom:18px;">
          <h1 style="margin:0;font-size:18px;font-weight:bold;color:#111827;">${orgName}</h1>
          <p style="margin:4px 0 0;font-size:11px;color:#6b7280;">${orgAddress}</p>
          <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">Email: ${orgEmail} | Tel: ${orgPhone}</p>
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
            <p style="margin:0;font-size:11px;font-weight:bold;">Treasurer</p>
            <p style="margin:4px 0 0;font-size:10px;color:#6b7280;">Authorized by Treasurer</p>
            ${signatureHtml}
          </div>
          ${stampHtml}
        </div>
      `;
      document.body.appendChild(container);
      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: `${memo.reference_number || memo.id}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(container)
        .save();
      document.body.removeChild(container);

      // Mark recipients as downloaded (best-effort)
      await supabase
        .from("memo_recipients")
        .update({ downloaded_at: new Date().toISOString() })
        .eq("memo_id", memo.id)
        .is("downloaded_at", null);
      toast.success("PDF downloaded");
    } catch (err: any) {
      toast.error(`Failed to download PDF: ${err.message}`);
    }
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

  const getStatusBadge = (status: string) => {
    if (status === "draft") {
      return <Badge variant="secondary">Draft</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800">Sent</Badge>;
  };

  const getRecipientStats = (memo: any) => {
    const recipients = memo.memo_recipients || [];
    const delivered = recipients.filter((r: any) => r.delivered_at).length;
    const seen = recipients.filter((r: any) => r.seen_at).length;
    const downloaded = recipients.filter((r: any) => r.downloaded_at).length;

    return { total: recipients.length, delivered, seen, downloaded };
  };

  const filteredMemos = memos.filter(
    (memo) =>
      memo.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      memo.reference_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#111827]">Memo History</h2>
        <p className="text-sm text-[#6B7280] mt-1">
          View, track, and manage all memos
        </p>
      </div>

      {/* Create Memo Button */}
      <Button
        onClick={() => navigate("/treasurer/memos/create")}
        className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
      >
        <Plus className="h-4 w-4 mr-2" />
        Create New Memo
      </Button>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-[#6B7280]" />
        <Input
          placeholder="Search by title or reference number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 border-[#E5E7EB]"
        />
      </div>

      {/* Memos Table */}
      <Card className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB]">
        <CardContent className="p-0">
          {filteredMemos.length === 0 ? (
            <div className="text-center py-12 text-[#6B7280]">
              <p>No memos found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E5E7EB]">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[#6B7280]">
                      Reference
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[#6B7280]">
                      Title
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[#6B7280]">
                      Category
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[#6B7280]">
                      Date Sent
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-[#6B7280]">
                      Status
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-[#6B7280]">
                      Tracking
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-[#6B7280]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMemos.map((memo: any) => {
                    const stats = getRecipientStats(memo);
                    return (
                      <tr
                        key={memo.id}
                        className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F9FAFB]"
                      >
                        <td className="py-3 px-4">
                          <p className="text-sm font-medium text-[#111827]">
                            {memo.reference_number}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm text-[#111827]">{memo.title}</p>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline">
                            {getCategoryLabel(memo.category)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-[#6B7280]">
                          {memo.sent_at
                            ? new Date(memo.sent_at).toLocaleDateString()
                            : "-"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {getStatusBadge(memo.status)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2 text-xs">
                            <span className="text-[#6B7280]">
                              {stats.delivered}/{stats.total}
                            </span>
                            <span className="text-green-600 font-medium">
                              {stats.seen}
                            </span>
                            <span className="text-blue-600 font-medium">
                              {stats.downloaded}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedMemo(memo);
                                setPreviewOpen(true);
                              }}
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {memo.status === "draft" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteMemo.mutate(memo.id)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                            {memo.status === "sent" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => resendMemo.mutate(memo.id)}
                                title="Resend"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Download PDF"
                              onClick={() => downloadMemoPDF(memo)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedMemo?.title}</DialogTitle>
          </DialogHeader>
          {selectedMemo && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[#6B7280] font-medium">Reference Number</p>
                  <p className="text-[#111827]">{selectedMemo.reference_number}</p>
                </div>
                <div>
                  <p className="text-[#6B7280] font-medium">Category</p>
                  <p className="text-[#111827]">{getCategoryLabel(selectedMemo.category)}</p>
                </div>
                <div>
                  <p className="text-[#6B7280] font-medium">Status</p>
                  <p className="text-[#111827]">{getStatusBadge(selectedMemo.status)}</p>
                </div>
                <div>
                  <p className="text-[#6B7280] font-medium">Date Sent</p>
                  <p className="text-[#111827]">
                    {selectedMemo.sent_at
                      ? new Date(selectedMemo.sent_at).toLocaleDateString()
                      : "-"}
                  </p>
                </div>
              </div>

              <div className="bg-[#F9FAFB] p-4 rounded-lg border border-[#E5E7EB]">
                <p className="text-sm font-medium text-[#6B7280] mb-2">Content</p>
                <p className="text-sm text-[#111827] whitespace-pre-wrap">
                  {selectedMemo.content}
                </p>
              </div>

              {selectedMemo.memo_recipients && selectedMemo.memo_recipients.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-[#6B7280] mb-2">
                    Recipients ({selectedMemo.memo_recipients.length})
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedMemo.memo_recipients.map((recipient: any) => (
                      <div
                        key={recipient.id}
                        className="flex items-center justify-between bg-white p-2 rounded border border-[#E5E7EB] text-sm"
                      >
                        <span className="text-[#111827]">{recipient.members?.name}</span>
                        <div className="flex gap-2">
                          {recipient.delivered_at && (
                            <Badge className="bg-blue-100 text-blue-800 text-xs">
                              Delivered
                            </Badge>
                          )}
                          {recipient.seen_at && (
                            <Badge className="bg-green-100 text-green-800 text-xs">
                              Seen
                            </Badge>
                          )}
                          {recipient.downloaded_at && (
                            <Badge className="bg-purple-100 text-purple-800 text-xs">
                              Downloaded
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setPreviewOpen(false)}
                  className="flex-1"
                >
                  Close
                </Button>
                <Button onClick={() => selectedMemo && downloadMemoPDF(selectedMemo)} className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white">
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
