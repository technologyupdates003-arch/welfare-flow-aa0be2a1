// Co-op Bank B2C transfer edge function.
// Initiates an outgoing transfer from the welfare account to a member's
// phone number for an approved withdrawal (penalty or donation wallet).
//
// Required secrets (set via Lovable Cloud secrets):
//   COOP_CONSUMER_KEY, COOP_CONSUMER_SECRET, COOP_ACCOUNT_NUMBER,
//   COOP_B2C_CALLBACK_URL (optional)
// If credentials are missing the function returns success=false with a
// descriptive error so the UI can surface a clear status to operators.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface B2CRequest {
  withdrawalId: string;
  amount: number;
  phoneNumber: string;
  reason: string;
  adminName?: string;
  walletType?: "penalty" | "donation";
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function getCoopToken(): Promise<string | null> {
  const key = Deno.env.get("COOP_CONSUMER_KEY");
  const secret = Deno.env.get("COOP_CONSUMER_SECRET");
  if (!key || !secret) return null;
  const auth = btoa(`${key}:${secret}`);
  const res = await fetch(
    "https://developer.co-opbank.co.ke:8243/token?grant_type=client_credentials",
    { method: "POST", headers: { Authorization: `Basic ${auth}` } },
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
    const body = (await req.json()) as B2CRequest;
    const { withdrawalId, amount, phoneNumber, reason, walletType = "penalty" } = body;

    if (!withdrawalId || !amount || !phoneNumber) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = await getCoopToken();
    const accountNumber = Deno.env.get("COOP_ACCOUNT_NUMBER");

    let mpesaTransactionId = `B2C-${Date.now()}-${withdrawalId.slice(0, 8)}`;
    let bankResponse: any = null;
    let success = false;
    let errorMessage: string | null = null;

    if (token && accountNumber) {
      // Real Co-op Bank IFT (Internal Funds Transfer to Mobile)
      const callbackUrl = Deno.env.get("COOP_B2C_CALLBACK_URL") ??
        `${SUPABASE_URL}/functions/v1/b2c-transfer/callback`;
      const payload = {
        MessageReference: mpesaTransactionId,
        CallBackUrl: callbackUrl,
        Source: { AccountNumber: accountNumber, Amount: amount, Narration: reason },
        Destinations: [
          {
            ReferenceNumber: mpesaTransactionId,
            AccountNumber: phoneNumber,
            BankCode: "MPESA",
            Amount: amount,
            Narration: reason,
          },
        ],
      };

      const res = await fetch(
        "https://developer.co-opbank.co.ke:8243/FundsTransfer/Mobile/3.0.0",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      bankResponse = await res.json().catch(() => ({}));
      success = res.ok && (bankResponse?.MessageReference != null);
      if (!success) {
        errorMessage = bankResponse?.MessageDescription ||
          bankResponse?.error_description || `Bank API ${res.status}`;
      }
    } else {
      errorMessage = "Co-op Bank credentials not configured (COOP_CONSUMER_KEY / COOP_CONSUMER_SECRET / COOP_ACCOUNT_NUMBER).";
    }

    // Record the attempt
    await supabase.from("b2c_transactions").insert({
      withdrawal_id: withdrawalId,
      mpesa_transaction_id: mpesaTransactionId,
      phone_number: phoneNumber,
      amount,
      status: success ? "initiated" : "failed",
      error_message: errorMessage,
    });

    return new Response(
      JSON.stringify({
        success,
        transactionId: mpesaTransactionId,
        message: success
          ? `Transfer of KES ${amount} initiated to ${phoneNumber}`
          : errorMessage,
        bank: bankResponse,
        walletType,
      }),
      {
        status: success ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
