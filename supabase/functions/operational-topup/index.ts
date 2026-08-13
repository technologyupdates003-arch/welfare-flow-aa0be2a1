// Operational wallet top-up handler
// Supports:
// 1. STK push C2B via Co-operative Bank
// 2. Manual ledger top-up (admin entry)
// Writes to wallet_transactions for unified ledger

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  COOP_STK_URL,
  callbackUrl as coopCallbackUrl,
  collectionAccount,
  coopConfigured,
  coopMessage,
  coopPost,
  coopSuccess,
  messageReference,
  normalizePhone,
} from "../_shared/coop.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface TopUpRequest {
  type: "stk_push" | "manual";
  amount: number;
  phone_number?: string;
  member_id?: string;
  reference?: string;
  notes?: string;
  created_by?: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = (await req.json()) as TopUpRequest;
    const { type, amount, phone_number, member_id, reference, notes, created_by } = body;

    if (!type || !amount) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: type, amount",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type === "stk_push") {
      // STK Push C2B flow
      if (!phone_number) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "phone_number required for STK push",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const phone = normalizePhone(phone_number);

      if (!coopConfigured()) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Co-op Bank not configured (COOP_CONSUMER_KEY / COOP_CONSUMER_SECRET)",
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const bankAccount = collectionAccount("operational");
      if (!bankAccount) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Collection account not configured (COOP_COLLECTION_ACCOUNT)",
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const msgRef = messageReference("OPTOP");
      const payload = {
        MessageReference: msgRef,
        CallBackUrl: coopCallbackUrl("coop-stk-callback"),
        MobileNumber: phone,
        Amount: Math.round(Number(amount)),
        AccountReference: (reference ?? `OP-${Date.now()}`).slice(0, 20),
        TransactionDescription: (notes ?? "Operational wallet top-up").slice(0, 50),
        BankAccountNumber: bankAccount,
        Currency: "KES",
        Narration: (notes ?? "KHCWW operational top-up").slice(0, 60),
      };

      const { ok, status, data: bankResponse } = await coopPost(COOP_STK_URL, payload);
      const success = ok && coopSuccess(bankResponse);
      const checkoutId =
        bankResponse?.CheckoutRequestID ?? bankResponse?.TransactionID ?? msgRef;

      // Record payment attempt
      const { data: paymentRecord } = await supabase
        .from("operational_payment_records")
        .insert({
          member_id,
          amount,
          source: "stk_push",
          status: success ? "pending" : "failed",
          mpesa_transaction_id: checkoutId,
          payment_ref: reference ?? `OP-${Date.now()}`,
          notes: notes ?? "Co-op Bank STK push initiated",
          created_by,
        })
        .select()
        .single();

      return new Response(
        JSON.stringify({
          success,
          message: success
            ? `STK push sent to ${phone}`
            : coopMessage(bankResponse) || `Co-op API ${status}`,
          paymentRecord,
          bank: bankResponse,
          account: bankAccount,
          provider: "coop-bank",
        }),
        {
          status: success ? 200 : 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );

    } else if (type === "manual") {
      // Manual ledger top-up (admin entry)
      // Record payment
      const { data: paymentRecord } = await supabase
        .from("operational_payment_records")
        .insert({
          member_id,
          amount,
          source: "manual_topup",
          status: "verified",
          payment_ref: reference ?? `MANUAL-${Date.now()}`,
          notes: notes ?? "Manual top-up",
          created_by,
          verified_at: new Date().toISOString(),
        })
        .select()
        .single();

      // Write to unified ledger
      const { data: ledgerEntry } = await supabase
        .from("wallet_transactions")
        .insert({
          wallet_type: "operational",
          direction: "in",
          source: "manual_topup",
          reference_id: paymentRecord?.id,
          reference_table: "operational_payment_records",
          party_name: notes ?? "Manual top-up",
          gross_amount: amount,
          mpesa_charge: 0,
          system_fee: 0,
          net_amount: amount,
          status: "completed",
          notes: notes ?? "Manual top-up",
          created_by,
        })
        .select()
        .single();

      // Update operational wallet balance
      const { data: walletRow } = await supabase
        .from("operational_wallet")
        .select("total_received, total_withdrawn, total_balance")
        .limit(1)
        .maybeSingle();

      if (walletRow) {
        const newReceived = (walletRow.total_received || 0) + amount;
        const newBalance = newReceived - (walletRow.total_withdrawn || 0);

        await supabase
          .from("operational_wallet")
          .update({
            total_received: newReceived,
            total_balance: newBalance,
            updated_at: new Date().toISOString(),
          })
          .eq("id", walletRow.id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Manual top-up of KES ${amount} recorded`,
          paymentRecord,
          ledgerEntry,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid type. Must be 'stk_push' or 'manual'",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (e) {
    console.error("Error:", e);
    return new Response(
      JSON.stringify({
        success: false,
        error: (e as Error).message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
