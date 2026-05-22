// Operational wallet top-up handler
// Supports:
// 1. STK push C2B (M-Pesa payment)
// 2. Manual ledger top-up (admin entry)
// Writes to wallet_transactions for unified ledger

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
const DARAJA_BASE =
  Deno.env.get("MPESA_BASE_URL") ?? "https://sandbox.safaricom.co.ke";

function normalizePhone(p: string): string {
  const digits = (p || "").replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return "254" + digits.slice(1);
  if (digits.startsWith("7") || digits.startsWith("1")) return "254" + digits;
  return digits;
}

async function getDarajaToken(): Promise<string | null> {
  const key = Deno.env.get("MPESA_CONSUMER_KEY");
  const secret = Deno.env.get("MPESA_CONSUMER_SECRET");
  if (!key || !secret) return null;
  const auth = btoa(`${key}:${secret}`);
  const res = await fetch(
    `${DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials`,
    { method: "GET", headers: { Authorization: `Basic ${auth}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token ?? null;
}

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
      const token = await getDarajaToken();

      if (!token) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "M-Pesa not configured (MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET)",
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const SHORTCODE = Deno.env.get("MPESA_SHORTCODE") ?? "174379";
      const PASSKEY = Deno.env.get("MPESA_PASSKEY") ?? "bfb279f9aa9bdbcf158e97dd1a503b6015d86092693d626c8401d1ecf8118a6a";
      const callbackUrl =
        Deno.env.get("MPESA_C2B_CALLBACK_URL") ??
        `${SUPABASE_URL}/functions/v1/sms-webhook`;

      const timestamp = new Date()
        .toISOString()
        .replace(/[^0-9]/g, "")
        .slice(0, 14);
      const password = btoa(`${SHORTCODE}${PASSKEY}${timestamp}`);

      const payload = {
        BusinessShortCode: SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.round(Number(amount)),
        PartyA: phone,
        PartyB: SHORTCODE,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: reference ?? `OP-${Date.now()}`,
        TransactionDesc: notes ?? "Operational wallet top-up",
      };

      const res = await fetch(`${DARAJA_BASE}/mpesa/stkpush/v1/processrequest`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const bankResponse = await res.json().catch(() => ({}));
      const success = res.ok && bankResponse?.ResponseCode === "0";

      // Record payment attempt
      const { data: paymentRecord } = await supabase
        .from("operational_payment_records")
        .insert({
          member_id,
          amount,
          source: "stk_push",
          status: success ? "pending" : "failed",
          mpesa_transaction_id: bankResponse?.CheckoutRequestID,
          payment_ref: reference ?? `OP-${Date.now()}`,
          notes: notes ?? "STK push initiated",
          created_by,
        })
        .select()
        .single();

      return new Response(
        JSON.stringify({
          success,
          message: success
            ? `STK push sent to ${phone}`
            : bankResponse?.errorMessage || `Daraja API ${res.status}`,
          paymentRecord,
          bank: bankResponse,
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
