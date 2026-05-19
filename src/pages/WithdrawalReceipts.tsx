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
              <div ref={printRef} className="bg-white text-foreground p-4" style={{ fontFamily: 'Arial, sans-serif' }}>
                {/* Memo Letterhead */}
                <div style={{ border: '2px solid #1f2937', padding: '20px', marginBottom: '20px', background: '#f9fafb', borderRadius: '8px' }}>
                  <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                    <div style={{ fontSize: '24px', fontWeight: '900', color: '#1f2937', letterSpacing: '1px' }}>KHCWW WELFARE</div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Kenyatta Hospital Community Welfare Wing</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Official Withdrawal Receipt</div>
                  </div>
                  <div style={{ borderTop: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db', padding: '10px 0', margin: '15px 0', textAlign: 'center', fontSize: '11px', color: '#6b7280' }}>
                    <div>📍 Nairobi, Kenya | 📞 +254 (0) 20 XXXX XXXX | 📧 welfare@khcww.org</div>
                  </div>
                </div>

                {/* Receipt Header */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#1f2937', marginBottom: '2px' }}>
                    {open.type === 'penalty' ? 'PENALTY WALLET' : 'FUNDS WALLET'} WITHDRAWAL RECEIPT
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af' }}>Generated: {new Date().toLocaleString()}</div>
                </div>

                {/* Receipt Details */}
                <div style={{ background: '#f3f4f6', padding: '15px', borderRadius: '6px', marginBottom: '20px', fontSize: '12px', lineHeight: '1.8' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '8px', fontWeight: '600', color: '#374151', width: '40%' }}>Receipt ID:</td>
                        <td style={{ padding: '8px', color: '#1f2937', fontFamily: 'monospace' }}>{open.id.substring(0, 12)}...</td>
                      </tr>
                      <tr style={{ background: '#fff' }}>
                        <td style={{ padding: '8px', fontWeight: '600', color: '#374151' }}>Withdrawal Amount:</td>
                        <td style={{ padding: '8px', color: '#059669', fontWeight: '700', fontSize: '14px' }}>KES {Number(open.amount).toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px', fontWeight: '600', color: '#374151' }}>Wallet Type:</td>
                        <td style={{ padding: '8px', color: '#1f2937', textTransform: 'capitalize' }}>{open.type} wallet</td>
                      </tr>
                      <tr style={{ background: '#fff' }}>
                        <td style={{ padding: '8px', fontWeight: '600', color: '#374151' }}>Withdrawal Reason:</td>
                        <td style={{ padding: '8px', color: '#1f2937' }}>{open.reason}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px', fontWeight: '600', color: '#374151' }}>Status:</td>
                        <td style={{ padding: '8px' }}>
                          <span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>
                            {open.status}
                          </span>
                        </td>
                      </tr>
                      <tr style={{ background: '#fff' }}>
                        <td style={{ padding: '8px', fontWeight: '600', color: '#374151' }}>Date Issued:</td>
                        <td style={{ padding: '8px', color: '#1f2937' }}>{new Date(open.submitted_at || open.created_at).toLocaleString()}</td>
                      </tr>
                      {open.phone_number && (
                        <tr>
                          <td style={{ padding: '8px', fontWeight: '600', color: '#374151' }}>Transfer To:</td>
                          <td style={{ padding: '8px', color: '#1f2937', fontFamily: 'monospace' }}>{open.phone_number}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Approvals Section */}
                <div style={{ marginTop: '30px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#1f2937', marginBottom: '15px', borderBottom: '2px solid #e5e7eb', paddingBottom: '8px' }}>
                    APPROVAL SIGNATURES
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                    {["chairperson", "secretary", "treasurer"].map((role) => {
                      const s = open.signatories.find((x) => x.signatory_role === role);
                      return (
                        <div key={role} style={{ border: '1px solid #e5e7eb', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px' }}>
                            {role}
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
                            {s?.full_name || '—'}
                          </div>
                          {s?.signature_url ? (
                            <img
                              src={s.signature_url}
                              alt={`${role} signature`}
                              style={{ maxWidth: '100%', maxHeight: '60px', margin: '8px auto', display: 'block' }}
                              crossOrigin="anonymous"
                            />
                          ) : (
                            <div style={{ height: '60px', borderTop: '1px solid #d1d5db', marginTop: '8px' }}></div>
                          )}
                          <div style={{ fontSize: '9px', color: '#9ca3af', marginTop: '8px' }}>
                            {s?.approved_at
                              ? `Approved ${new Date(s.approved_at).toLocaleString()}`
                              : "Pending"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer */}
                <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '2px solid #1f2937' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px', fontSize: '10px', color: '#6b7280', textAlign: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>Prepared By</div>
                      <div style={{ borderTop: '1px solid #d1d5db', paddingTop: '8px', height: '40px' }}></div>
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>Approved By</div>
                      <div style={{ borderTop: '1px solid #d1d5db', paddingTop: '8px', height: '40px' }}></div>
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>Date</div>
                      <div style={{ borderTop: '1px solid #d1d5db', paddingTop: '8px', height: '40px' }}></div>
                    </div>
                  </div>
                  
                  <div style={{ background: '#f3f4f6', padding: '15px', borderRadius: '6px', marginTop: '20px', fontSize: '9px', color: '#6b7280', lineHeight: '1.6' }}>
                    <div style={{ fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>IMPORTANT NOTES:</div>
                    <ul style={{ margin: '0', paddingLeft: '20px' }}>
                      <li>This receipt is valid only with authorized signatures</li>
                      <li>Keep this receipt for your records and audit purposes</li>
                      <li>For disputes or inquiries, contact the Finance Department within 30 days</li>
                      <li>All withdrawals are subject to KHCWW Welfare policies and regulations</li>
                    </ul>
                  </div>

                  <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #e5e7eb', fontSize: '9px', color: '#9ca3af' }}>
                    <p style={{ margin: '0' }}>KHCWW Welfare System | Confidential Document</p>
                    <p style={{ margin: '5px 0 0 0' }}>© 2026 Kenyatta Hospital Community Welfare Wing. All Rights Reserved.</p>
                  </div>
                </div>
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
