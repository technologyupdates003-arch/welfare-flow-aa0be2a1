// Co-operative Bank STK Push result callback.
//
// Give this URL to Co-op Bank as the STK/collection callback:
//   https://<project>.supabase.co/functions/v1/coop-stk-callback
//
// It is public (no JWT) so the bank can post to it. It matches the payment
// record by CheckoutRequestID / MessageReference, marks it verified or failed,
// and writes the unified wallet ledger entry.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { coopSuccess, coopMessage } from "../_shared/coop.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const WALLETS = [
  { kind: "penalty", table: "penalty_payment_records", wallet: "penalty_wallet", updatedAt: "last_updated" },
  { kind: "donation", table: "donation_payment_records", wallet: "donation_wallet", updatedAt: "updated_at" },
  { kind: "operational", table: "operational_payment_records", wallet: "operational_wallet", updatedAt: "updated_at" },
] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    // Co-op may nest the result; accept both shapes.
    const p = body?.Body?.stkCallback ?? body?.Data ?? body ?? {};
    const checkoutId =
      p.CheckoutRequestID ?? p.MessageReference ?? p.TransactionID ?? p.OriginatorConversationID;
    const receipt =
      p.MpesaReceiptNumber ?? p.TransactionReference ?? p.ThirdPartyTransactionID ?? p.TransactionID ?? null;
    const paid = coopSuccess(p) || Number(p.ResultCode) === 0;

    console.log("coop-stk-callback", JSON.stringify({ checkoutId, receipt, paid }));

    if (!checkoutId) {
      return new Response(JSON.stringify({ received: true, ignored: "no reference" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const w of WALLETS) {
      const { data: record } = await supabase
        .from(w.table)
        .select("id, amount, member_id, status")
        .eq("mpesa_transaction_id", checkoutId)
        .maybeSingle();

      if (!record) continue;
      if (record.status === "verified") break;

      if (!paid) {
        await supabase
          .from(w.table)
          .update({ status: "failed", notes: coopMessage(p) })
          .eq("id", record.id);
        break;
      }

      await supabase
        .from(w.table)
        .update({
          status: "verified",
          payment_ref: receipt,
          verified_at: new Date().toISOString(),
        })
        .eq("id", record.id);

      // Unified ledger entry (the wallet balance triggers pick this up).
      await supabase.from("wallet_transactions").insert({
        wallet_type: w.kind,
        direction: "in",
        source: "c2b",
        reference_id: record.id,
        reference_table: w.table,
        party_name: null,
        gross_amount: record.amount,
        mpesa_charge: 0,
        system_fee: 0,
        net_amount: record.amount,
        mpesa_receipt: receipt,
        status: "completed",
        notes: "Co-op Bank STK collection",
      });

      break;
    }

    return new Response(
      JSON.stringify({ MessageCode: "0", MessageDescription: "Received" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("coop-stk-callback error", e);
    // Always 200 so the bank does not retry-loop.
    return new Response(
      JSON.stringify({ MessageCode: "0", MessageDescription: "Received" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
