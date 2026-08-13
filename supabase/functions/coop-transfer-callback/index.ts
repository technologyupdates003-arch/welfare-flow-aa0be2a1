// Co-operative Bank funds-transfer (payout) result callback.
//
// Give this URL to Co-op Bank as the funds transfer / disbursement callback:
//   https://<project>.supabase.co/functions/v1/coop-transfer-callback
//
// Public (no JWT) so the bank can post to it. Confirms or reverses a payout.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { coopSuccess, coopMessage } from "../_shared/coop.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const WITHDRAWAL_TABLES: Record<string, string> = {
  penalty: "penalty_withdrawals",
  donation: "donation_withdrawals",
  operational: "operational_withdrawals",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const p: any = body?.Data ?? body ?? {};
    const reference =
      p.Reference ?? p.MessageReference ?? p.OriginatorConversationID ?? null;
    const receipt =
      p.TransactionReference ?? p.TransactionID ?? p.ThirdPartyTransactionID ?? null;
    const ok = coopSuccess(p);
    const charge = Number(p.Charge ?? p.TransactionFee ?? 0) || 0;

    console.log("coop-transfer-callback", JSON.stringify({ reference, receipt, ok }));

    // Locate the b2c_transactions row by withdrawal id or bank receipt.
    let txn: any = null;
    if (reference) {
      const { data } = await supabase
        .from("b2c_transactions")
        .select("id, withdrawal_id, wallet_type, amount")
        .eq("withdrawal_id", reference)
        .order("initiated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      txn = data;
    }
    if (!txn && receipt) {
      const { data } = await supabase
        .from("b2c_transactions")
        .select("id, withdrawal_id, wallet_type, amount")
        .eq("mpesa_transaction_id", receipt)
        .maybeSingle();
      txn = data;
    }

    if (txn) {
      await supabase
        .from("b2c_transactions")
        .update({
          status: ok ? "completed" : "failed",
          mpesa_transaction_id: receipt ?? undefined,
          mpesa_charge: charge,
          completed_at: ok ? new Date().toISOString() : null,
          transaction_completed_at: ok ? new Date().toISOString() : null,
          error_message: ok ? null : coopMessage(p),
        })
        .eq("id", txn.id);

      const table = WITHDRAWAL_TABLES[txn.wallet_type as string];
      if (table && !ok) {
        await supabase
          .from(table)
          .update({ status: "failed" })
          .eq("id", txn.withdrawal_id);
      }
    }

    return new Response(
      JSON.stringify({ MessageCode: "0", MessageDescription: "Received" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("coop-transfer-callback error", e);
    return new Response(
      JSON.stringify({ MessageCode: "0", MessageDescription: "Received" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
