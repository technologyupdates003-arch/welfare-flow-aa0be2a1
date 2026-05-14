import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, FileText, Printer, Download, Receipt } from "lucide-react";
import { toast } from "sonner";

interface SignatoryInfo {
  signatory_role: string;
  status: string;
  signature_url?: string | null;
  approved_at?: string | null;
  signatory_user_id?: string | null;
  full_name?: string | null;
}

interface ReceiptRow {
  id: string;
  amount: number;
  reason: string;
  status: string;
  phone_number?: string | null;
  created_at: string;
  submitted_at?: string | null;
  type: "penalty" | "donation";
  signatories: SignatoryInfo[];
}

export default function WithdrawalReceipts() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [open, setOpen] = useState<ReceiptRow | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [pen, don, sigs] = await Promise.all([
          supabase
            .from("penalty_withdrawals")
            .select(`
              id, amount, reason, status, phone_number, created_at, submitted_at,
              withdrawal_signatories ( signatory_role, status, signature_url, approved_at, signatory_user_id )
            `)
            .eq("status", "completed")
            .order("submitted_at", { ascending: false }),
          supabase
            .from("donation_withdrawals")
            .select(`
              id, amount, reason, status, phone_number, created_at, submitted_at,
              donation_withdrawal_signatories ( signatory_role, status, signature_url, approved_at, signatory_user_id )
            `)
            .eq("status", "completed")
            .order("submitted_at", { ascending: false }),
          supabase.from("signatory_signatures").select("user_id, signatory_role, signature_url, full_name"),
        ]);
        if (pen.error) throw pen.error;
        if (don.error) throw don.error;

        const sigMap = new Map<string, any>();
        sigs.data?.forEach((s: any) => {
          sigMap.set(`${s.user_id}-${s.signatory_role}`, s);
          if (!sigMap.has(s.signatory_role)) sigMap.set(s.signatory_role, s);
        });

        const enrich = (s: any): SignatoryInfo => {
          const found =
            (s.signatory_user_id && sigMap.get(`${s.signatory_user_id}-${s.signatory_role}`)) ||
            sigMap.get(s.signatory_role);
          return {
            signatory_role: s.signatory_role,
            status: s.status,
            approved_at: s.approved_at,
            signatory_user_id: s.signatory_user_id,
            signature_url: s.signature_url || found?.signature_url,
            full_name: found?.full_name,
          };
        };

        const all: ReceiptRow[] = [
          ...(pen.data || []).map((w: any) => ({
            ...w,
            type: "penalty" as const,
            signatories: (w.withdrawal_signatories || []).map(enrich),
          })),
          ...(don.data || []).map((w: any) => ({
            ...w,
            type: "donation" as const,
            signatories: (w.donation_withdrawal_signatories || []).map(enrich),
          })),
        ].sort(
          (a, b) =>
            new Date(b.submitted_at || b.created_at).getTime() -
            new Date(a.submitted_at || a.created_at).getTime()
        );

        setRows(all);
      } catch (e: any) {
        console.error(e);
        toast.error("Failed to load receipts");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handlePrint = () => {
    if (!printRef.current) return;
    const html = printRef.current.innerHTML;
    const w = window.open("", "_blank", "width=900,height=900");
    if (!w) return;
    w.document.write(`<html><head><title>Withdrawal Receipt</title>
      <style>
        body{font-family:Arial,sans-serif;padding:32px;color:#111}
        h1{margin:0 0 8px} .muted{color:#555;font-size:12px}
        .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee}
        .sig{margin-top:24px;padding:12px;border:1px solid #ddd;border-radius:8px}
        .sig img{max-height:60px;display:block;margin-top:6px}
        .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:16px}
      </style></head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const handleDownload = async () => {
    if (!printRef.current || !open) return;
    try {
      const mod: any = await import("html2pdf.js");
      const html2pdf = mod.default || mod;
      await html2pdf()
        .set({
          margin: 10,
          filename: `receipt-${open.type}-${open.id.slice(0, 8)}.pdf`,
          image: { type: "jpeg", quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(printRef.current)
        .save();
    } catch (e) {
      console.error(e);
      toast.error("Download failed, use Print instead");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Receipt className="h-7 w-7" /> Withdrawal Receipts
        </h1>
        <p className="text-muted-foreground mt-1">
          Completed withdrawals from the penalty and donation wallets. Each receipt is prefilled
          with signatory names and signatures.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
            No completed withdrawals yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <Card key={`${r.type}-${r.id}`} className="hover:shadow-md transition">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      KES {Number(r.amount).toLocaleString()}
                    </CardTitle>
                    <CardDescription>{r.reason}</CardDescription>
                  </div>
                  <Badge variant="secondary" className="capitalize">
                    {r.type} wallet
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between pt-2">
                <div className="text-xs text-muted-foreground">
                  {new Date(r.submitted_at || r.created_at).toLocaleString()} ·{" "}
                  {r.phone_number || "—"}
                </div>
                <Button size="sm" variant="outline" onClick={() => setOpen(r)}>
                  <FileText className="h-4 w-4 mr-2" />
                  View Receipt
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Withdrawal Receipt</DialogTitle>
          </DialogHeader>
          {open && (
            <>
              <div ref={printRef} className="bg-white text-foreground p-4">
                <h1 className="text-2xl font-bold">KHCWW Welfare</h1>
                <p className="muted text-xs text-muted-foreground">
                  Official Withdrawal Receipt
                </p>
                <div className="mt-4 space-y-1 text-sm">
                  <div className="row flex justify-between border-b py-1">
                    <span className="font-medium">Receipt No.</span>
                    <span>{open.id.slice(0, 8).toUpperCase()}</span>
                  </div>
                  <div className="row flex justify-between border-b py-1">
                    <span className="font-medium">Wallet</span>
                    <span className="capitalize">{open.type} wallet</span>
                  </div>
                  <div className="row flex justify-between border-b py-1">
                    <span className="font-medium">Amount</span>
                    <span>KES {Number(open.amount).toLocaleString()}</span>
                  </div>
                  <div className="row flex justify-between border-b py-1">
                    <span className="font-medium">Reason</span>
                    <span>{open.reason}</span>
                  </div>
                  <div className="row flex justify-between border-b py-1">
                    <span className="font-medium">Recipient Phone</span>
                    <span>{open.phone_number || "—"}</span>
                  </div>
                  <div className="row flex justify-between border-b py-1">
                    <span className="font-medium">Date Issued</span>
                    <span>{new Date(open.submitted_at || open.created_at).toLocaleString()}</span>
                  </div>
                  <div className="row flex justify-between border-b py-1">
                    <span className="font-medium">Status</span>
                    <span className="uppercase">{open.status}</span>
                  </div>
                </div>

                <h3 className="mt-6 mb-2 font-semibold">Authorising Signatories</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {["chairperson", "secretary", "treasurer"].map((role) => {
                    const s = open.signatories.find((x) => x.signatory_role === role);
                    return (
                      <div key={role} className="sig border rounded-md p-3">
                        <div className="text-xs uppercase text-muted-foreground">{role}</div>
                        <div className="font-medium text-sm mt-1">
                          {s?.full_name || "—"}
                        </div>
                        {s?.signature_url ? (
                          <img
                            src={s.signature_url}
                            alt={`${role} signature`}
                            className="h-14 object-contain mt-2"
                            crossOrigin="anonymous"
                          />
                        ) : (
                          <div className="h-14 mt-2 flex items-center text-xs text-muted-foreground italic">
                            No signature on file
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {s?.approved_at
                            ? `Approved ${new Date(s.approved_at).toLocaleString()}`
                            : "Not approved"}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="muted text-[10px] text-muted-foreground mt-6 text-center">
                  This receipt is system-generated upon successful B2C transfer.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" /> Print
                </Button>
                <Button className="flex-1" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" /> Download PDF
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
