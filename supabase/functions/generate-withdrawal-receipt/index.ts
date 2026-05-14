import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WithdrawalData {
  id: string;
  amount: number;
  reason: string;
  status: string;
  created_at: string;
  signatories: Array<{
    signatory_role: string;
    status: string;
    signature_url?: string;
    approved_at?: string;
    signatory_user_id?: string;
    signatureInfo?: {
      full_name?: string;
      signature_url?: string;
    };
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { withdrawalId } = await req.json();

    if (!withdrawalId) {
      return new Response(
        JSON.stringify({ error: "Missing withdrawalId" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch withdrawal data
    const { data: withdrawal, error: fetchError } = await supabaseClient
      .from("penalty_withdrawals")
      .select(
        `
        id,
        amount,
        reason,
        status,
        created_at,
        withdrawal_signatories (
          signatory_role,
          status,
          signature_url,
          approved_at,
          signatory_user_id
        )
      `
      )
      .eq("id", withdrawalId)
      .single();

    if (fetchError || !withdrawal) {
      return new Response(
        JSON.stringify({ error: "Withdrawal not found" }),
        { status: 404, headers: corsHeaders }
      );
    }

    const { data: signaturesData, error: signaturesError } = await supabaseClient
      .from("signatory_signatures")
      .select("user_id, signatory_role, signature_url, full_name");

    if (signaturesError) {
      return new Response(
        JSON.stringify({ error: "Failed to load signatory signatures" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const signaturesMap = new Map<string, any>();
    signaturesData?.forEach((sig: any) => {
      signaturesMap.set(`${sig.user_id}-${sig.signatory_role}`, sig);
      signaturesMap.set(sig.signatory_role, sig);
    });

    const getSignatureInfo = (s: any) =>
      signaturesMap.get(
        s.signatory_user_id
          ? `${s.signatory_user_id}-${s.signatory_role}`
          : s.signatory_role
      ) || signaturesMap.get(s.signatory_role);

    const withdrawalWithSignatures: WithdrawalData = {
      ...withdrawal,
      signatories: withdrawal.signatory_signatories?.map((sig: any) => ({
        ...sig,
        signatureInfo: getSignatureInfo(sig),
      })) || [],
    };

    // Generate PDF content
    const pdfContent = generatePDFContent(withdrawalWithSignatures);

    // Upload PDF to storage
    const fileName = `withdrawal-receipt-${withdrawalId}-${Date.now()}.pdf`;
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from("withdrawal-receipts")
      .upload(fileName, pdfContent, {
        contentType: "application/pdf",
      });

    if (uploadError) {
      return new Response(
        JSON.stringify({ error: "Failed to upload receipt" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Get public URL
    const { data: publicUrl } = supabaseClient.storage
      .from("withdrawal-receipts")
      .getPublicUrl(fileName);

    // Store receipt record
    const { error: recordError } = await supabaseClient
      .from("withdrawal_receipts")
      .insert({
        withdrawal_id: withdrawalId,
        receipt_pdf_url: publicUrl.publicUrl,
      });

    if (recordError) {
      console.error("Error storing receipt record:", recordError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        receiptUrl: publicUrl.publicUrl,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});

function escapePdfString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function generatePDFContent(withdrawal: WithdrawalData): Uint8Array {
  // Simple PDF generation using text
  // In production, use a library like jsPDF or similar
  const approvalsText = withdrawal.signatories
    .map((sig) => {
      const role = escapePdfString(sig.signatory_role.toUpperCase());
      const status = escapePdfString(sig.status.toUpperCase());
      const name = escapePdfString(sig.signatureInfo?.full_name || "Not available");
      const signatureUrl = escapePdfString(sig.signatureInfo?.signature_url || "Not available");
      return `(${role}: ${status}) Tj\n0 -20 Td\n( Name: ${name}) Tj\n0 -20 Td\n( Signature URL: ${signatureUrl}) Tj\n0 -40 Td\n`;
    })
    .join("");

  const content = `
%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources 4 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>
endobj
4 0 obj
<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >>
endobj
5 0 obj
<< /Length 1500 >>
stream
BT
/F1 24 Tf
50 750 Td
(PENALTY WALLET WITHDRAWAL RECEIPT) Tj
0 -40 Td
/F1 12 Tf
(Withdrawal ID: ${escapePdfString(withdrawal.id)}) Tj
0 -20 Td
(Amount: KES ${withdrawal.amount.toLocaleString()}) Tj
0 -20 Td
(Reason: ${escapePdfString(withdrawal.reason)}) Tj
0 -20 Td
(Status: ${escapePdfString(withdrawal.status)}) Tj
0 -20 Td
(Date: ${escapePdfString(new Date(withdrawal.created_at).toLocaleString())}) Tj
0 -40 Td
/F1 14 Tf
(APPROVALS) Tj
0 -20 Td
/F1 12 Tf
${approvalsText}
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000214 00000 n 
0000000313 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
1863
%%EOF
  `;

  return new TextEncoder().encode(content);
}
