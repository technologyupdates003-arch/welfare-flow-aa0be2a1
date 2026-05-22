// Internal helper to insert wallet_transactions with running_balance
// Called by other edge functions (C2B, top-ups, expenses) to maintain unified ledger
// The trigger on wallet_transactions auto-computes running_balance

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface WalletLedgerEntry {
  wallet_type: "penalty" | "donation" | "operational";
  direction: "in" | "out";
  source: string; // c2b | b2c | stk_push | topup | expense | transfer | manual
  reference_id?: string;
  reference_table?: string;
  party_name?: string;
  party_phone?: string;
  gross_amount: number;
  mpesa_charge?: number;
  system_fee?: number;
  net_amount?: number;
  mpesa_receipt?: string;
  status?: string;
  notes?: string;
  created_by?: string;
  occurred_at?: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = (await req.json()) as WalletLedgerEntry;

    // Validate required fields
    if (!body.wallet_type || !body.direction || !body.source || body.gross_amount === undefined) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: wallet_type, direction, source, gross_amount",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Compute net_amount if not provided
    let netAmount = body.net_amount ?? 0;
    if (netAmount === 0) {
      const mpesaCharge = body.mpesa_charge ?? 0;
      const systemFee = body.system_fee ?? 0;
      if (body.direction === "in") {
        netAmount = body.gross_amount - mpesaCharge - systemFee;
      } else {
        netAmount = body.gross_amount + mpesaCharge + systemFee;
      }
    }

    // Insert into wallet_transactions
    // The trigger will auto-compute running_balance
    const { data, error } = await supabase
      .from("wallet_transactions")
      .insert({
        wallet_type: body.wallet_type,
        direction: body.direction,
        source: body.source,
        reference_id: body.reference_id,
        reference_table: body.reference_table,
        party_name: body.party_name,
        party_phone: body.party_phone,
        gross_amount: body.gross_amount,
        mpesa_charge: body.mpesa_charge ?? 0,
        system_fee: body.system_fee ?? 0,
        net_amount: netAmount,
        mpesa_receipt: body.mpesa_receipt,
        status: body.status ?? "completed",
        notes: body.notes,
        created_by: body.created_by,
        occurred_at: body.occurred_at ?? new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error inserting wallet transaction:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        transaction: data,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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
