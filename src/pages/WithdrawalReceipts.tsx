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
  type: "penalty" | "donation" | "operational";
  signatories: SignatoryInfo[];
}

export default function WithdrawalReceipts() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [open, setOpen] = useState<ReceiptRow | null>(null);
  const [orgSettings, setOrgSettings] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [pen, don, op, sigs, org] = await Promise.all([
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
          supabase
            .from("operational_withdrawals")
            .select(`
              id, amount, reason, status, phone_number, created_at, submitted_at,
              operational_withdrawal_signatories ( signatory_role, status, signature_url, approved_at, signatory_user_id )
            `)
            .eq("status", "completed")
            .order("submitted_at", { ascending: false }),
          supabase.from("signatory_signatures").select("user_id, signatory_role, signature_url, full_name"),
          supabase.from("organization_settings").select("*").maybeSingle(),
        ]);
        if (pen.error) throw pen.error;
        if (don.error) throw don.error;
        if (op.error) throw op.error;
        setOrgSettings(org.data || null);

        const sigMap = new Map<string, any>();
        if (sigs.data && Array.isArray(sigs.data)) {
          sigs.data.forEach((s: any) => {
            if (s?.user_id && s?.signatory_role) {
              sigMap.set(`${s.user_id}-${s.signatory_role}`, s);
              if (!sigMap.has(s.signatory_role)) sigMap.set(s.signatory_role, s);
            }
          });
        }

        const enrich = (s: any): SignatoryInfo => {
          const found =
            (s?.signatory_user_id && sigMap?.get(`${s.signatory_user_id}-${s.signatory_role}`)) ||
            sigMap?.get(s?.signatory_role);
          return {
            signatory_role: s?.signatory_role,
            status: s?.status,
            approved_at: s?.approved_at,
            signatory_user_id: s?.signatory_user_id,
            signature_url: s?.signature_url || found?.signature_url,
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
          ...(op.data || []).map((w: any) => ({
            ...w,
            type: "operational" as const,
            signatories: (w.operational_withdrawal_signatories || []).map(enrich),
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
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    w.document.write(`<html><head><title>Withdrawal Receipt</title>
      <style>
        body{font-family:Arial,sans-serif;padding:12px;color:#111;max-width:400px;margin:0 auto}
        .receipt{width:100%;max-width:400px}
        h1{margin:0;font-size:14px} .muted{color:#555;font-size:10px}
        .row{display:flex;justify-content:space-between;padding:4px 0;font-size:11px;border-bottom:1px solid #eee}
        .sig{margin-top:12px;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:9px}
        .sig img{max-height:40px;display:block;margin-top:4px}
        .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:12px;font-size:9px}
      </style></head><body><div class="receipt">${html}</div></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const handleDownload = async () => {
    if (!printRef.current || !open) return;
    try {
      // Wait for all images to load
      const images = printRef.current.querySelectorAll('img');
      await Promise.all(
        Array.from(images).map(
          (img) =>
            new Promise((resolve) => {
              if (img.complete) {
                resolve(null);
              } else {
                img.onload = () => resolve(null);
                img.onerror = () => resolve(null);
              }
            })
        )
      );

      const mod: any = await import("html2pdf.js");
      const html2pdf = mod.default || mod;
      await html2pdf()
        .set({
          margin: [8, 8, 8, 8],
          filename: `receipt-${open.type}-${open.id.slice(0, 8)}.pdf`,
          image: { type: "jpeg", quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, allowTaint: true },
          jsPDF: { unit: "mm", format: [210, 297], orientation: "portrait" },
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
              <div ref={printRef} className="bg-white text-foreground" style={{ fontFamily: "'Times New Roman', Times, serif", padding: '20px', maxWidth: '210mm' }}>
                {/* Header with Logo */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', paddingBottom: '15px', borderBottom: '3px solid #f97316' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    {orgSettings?.logo_url ? (
                      <img src={orgSettings.logo_url} alt="Organization logo" style={{ height: '60px', width: '60px', objectFit: 'contain' }} />
                    ) : null}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', marginBottom: '5px' }}>
                      {orgSettings?.organization_name || "KHCWW"}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280', lineHeight: '1.5' }}>
                      <div>{orgSettings?.organization_address || 'P.O.BOX 24-10300 KERUGOYA, LOCATION: KCRH'}</div>
                      <div style={{ color: '#f97316', fontWeight: '600' }}>Email: {orgSettings?.organization_email || 'Khcww2020@gmail.com'}</div>
                      <div>Tel: {orgSettings?.organization_phone || '+254 712 345 678'}</div>
                    </div>
                  </div>
                </div>

                {/* Receipt Title */}
                <div style={{ textAlign: 'center', marginBottom: '20px', fontSize: '11px', fontWeight: 'bold', color: '#f97316', letterSpacing: '2px' }}>
                  KHCWW OFFICIAL WITHDRAWAL RECEIPT
                </div>

                {/* Receipt Type */}
                <div style={{ marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '14px', fontWeight: 'bold', color: '#111827', margin: '0 0 5px 0' }}>
                    {open.type === 'penalty' ? 'PENALTY WALLET WITHDRAWAL RECEIPT' : open.type === 'operational' ? 'OPERATIONAL WALLET WITHDRAWAL RECEIPT' : 'FUNDS WALLET WITHDRAWAL RECEIPT'}
                  </h2>
                  <div style={{ fontSize: '10px', color: '#6b7280' }}>Generated: {new Date().toLocaleString()}</div>
                </div>

                {/* Receipt Details Table */}
                <div style={{ marginBottom: '20px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <tbody>
                      <tr style={{ background: '#f3f4f6' }}>
                        <td style={{ padding: '8px', fontWeight: '600', color: '#374151', width: '35%', border: '1px solid #e5e7eb' }}>Receipt ID:</td>
                        <td style={{ padding: '8px', color: '#1f2937', border: '1px solid #e5e7eb', fontFamily: 'monospace' }}>{open.id.substring(0, 12)}...</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px', fontWeight: '600', color: '#374151', border: '1px solid #e5e7eb' }}>Withdrawal Amount:</td>
                        <td style={{ padding: '8px', color: '#059669', fontWeight: '700', border: '1px solid #e5e7eb' }}>KES {Number(open.amount).toLocaleString()}</td>
                      </tr>
                      <tr style={{ background: '#f3f4f6' }}>
                        <td style={{ padding: '8px', fontWeight: '600', color: '#374151', border: '1px solid #e5e7eb' }}>Wallet Type:</td>
                        <td style={{ padding: '8px', color: '#1f2937', border: '1px solid #e5e7eb' }}>{open.type === 'penalty' ? 'Penalty Wallet' : 'Funds Wallet'}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px', fontWeight: '600', color: '#374151', border: '1px solid #e5e7eb' }}>Withdrawal Reason:</td>
                        <td style={{ padding: '8px', color: '#1f2937', border: '1px solid #e5e7eb' }}>{open.reason}</td>
                      </tr>
                      <tr style={{ background: '#f3f4f6' }}>
                        <td style={{ padding: '8px', fontWeight: '600', color: '#374151', border: '1px solid #e5e7eb' }}>Status:</td>
                        <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>
                          <span style={{ background: '#dbeafe', color: '#1e40af', padding: '3px 6px', borderRadius: '3px', fontWeight: '600', fontSize: '10px' }}>
                            {open.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px', fontWeight: '600', color: '#374151', border: '1px solid #e5e7eb' }}>Date Issued:</td>
                        <td style={{ padding: '8px', color: '#1f2937', border: '1px solid #e5e7eb' }}>{new Date(open.submitted_at || open.created_at).toLocaleString()}</td>
                      </tr>
                      {open.phone_number && (
                        <tr style={{ background: '#f3f4f6' }}>
                          <td style={{ padding: '8px', fontWeight: '600', color: '#374151', border: '1px solid #e5e7eb' }}>Transfer To:</td>
                          <td style={{ padding: '8px', color: '#1f2937', border: '1px solid #e5e7eb', fontFamily: 'monospace' }}>{open.phone_number}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Approval Signatures */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#111827', marginBottom: '15px', paddingBottom: '8px', borderBottom: '1px solid #111827' }}>
                    APPROVAL SIGNATURES
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                    {["chairperson", "secretary", "treasurer"].map((role) => {
                      const s = open.signatories.find((x) => x.signatory_role === role);
                      return (
                        <div key={role} style={{ textAlign: 'center', borderTop: '1px solid #111827', paddingTop: '10px' }}>
                          <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#111827', textTransform: 'uppercase', marginBottom: '8px' }}>
                            {role}
                          </div>
                          <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px', minHeight: '16px' }}>
                            {s?.full_name || '—'}
                          </div>
                          {s?.signature_url ? (
                            <img
                              src={s.signature_url}
                              alt={`${role} signature`}
                              style={{ maxWidth: '100%', maxHeight: '40px', margin: '5px auto', display: 'block' }}
                              crossOrigin="anonymous"
                            />
                          ) : (
                            <div style={{ height: '40px', borderTop: '1px solid #111827', marginTop: '5px' }}></div>
                          )}
                          <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '5px' }}>
                            {s?.approved_at ? `Approved ${new Date(s.approved_at).toLocaleString()}` : '○'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Signatures (stamp removed) */}
                <div style={{ marginTop: '30px', paddingTop: '15px', borderTop: '2px solid #111827' }}>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '5px' }}>Prepared By</div>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '5px' }}>Approved By</div>
                  <div style={{ fontSize: '10px', fontWeight: 'bold' }}>Date</div>
                </div>

                {/* Important Notes */}
                <div style={{ marginTop: '20px', padding: '12px', background: '#f3f4f6', borderRadius: '4px', fontSize: '9px', color: '#6b7280', lineHeight: '1.5' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>IMPORTANT NOTES:</div>
                  <div>This receipt is valid only with authorized signatures</div>
                  <div>Keep this receipt for your records and audit purposes</div>
                  <div>For disputes or inquiries, contact the Finance Department within 30 days</div>
                  <div>All withdrawals are subject to KHCWW Welfare policies and regulations</div>
                </div>

                {/* Bottom Footer */}
                <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '9px', color: '#6b7280', borderTop: '1px solid #e5e7eb', paddingTop: '10px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>{orgSettings?.organization_name || "KHCWW"}</div>
                  <div>{orgSettings?.organization_address || 'P.O.BOX 24-10300 KERUGOYA, LOCATION: KCRH'}</div>
                  <div>Email: {orgSettings?.organization_email || 'Khcww2020@gmail.com'} | Tel: {orgSettings?.organization_phone || '+254 712 345 678'}</div>
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
