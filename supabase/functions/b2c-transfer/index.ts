// Safaricom Daraja SANDBOX B2C transfer.
// Pays out approved withdrawals from either the penalty or donation wallet
// to a member's M-Pesa number using sandbox credentials.
//
// Required secrets: MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET
// Sandbox public defaults are used for shortcode/initiator/security credential.

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

const DARAJA_BASE =
  Deno.env.get("MPESA_BASE_URL") ?? "https://sandbox.safaricom.co.ke";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Public sandbox defaults from Safaricom Daraja docs
const SANDBOX_B2C_SHORTCODE = "600000";
const SANDBOX_INITIATOR_NAME = "testapi";
// Pre-encrypted security credential for the sandbox testapi user
const SANDBOX_SECURITY_CREDENTIAL =
  "Safaricom999!*!";

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
    { method: "GET", headers: { Authorization: `Basic ${auth}` } },
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
    const {
      withdrawalId,
      amount,
      phoneNumber,
      reason,
      walletType = "penalty",
    } = body;

    if (!withdrawalId || !amount || !phoneNumber) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const phone = normalizePhone(phoneNumber);
    const token = await getDarajaToken();

    const mpesaTransactionId = `B2C-${Date.now()}-${withdrawalId.slice(0, 8)}`;
    let bankResponse: any = null;
    let success = false;
    let errorMessage: string | null = null;

    if (token) {
      const SHORTCODE =
        Deno.env.get("MPESA_B2C_SHORTCODE") ?? SANDBOX_B2C_SHORTCODE;
      const INITIATOR =
        Deno.env.get("MPESA_INITIATOR_NAME") ?? SANDBOX_INITIATOR_NAME;
      const SECURITY_CREDENTIAL =
        Deno.env.get("MPESA_SECURITY_CREDENTIAL") ?? SANDBOX_SECURITY_CREDENTIAL;
      const callbackUrl =
        Deno.env.get("MPESA_B2C_CALLBACK_URL") ??
        `${SUPABASE_URL}/functions/v1/b2c-transfer/callback`;
      const timeoutUrl =
        Deno.env.get("MPESA_B2C_TIMEOUT_URL") ?? callbackUrl;

      const payload = {
        OriginatorConversationID: mpesaTransactionId,
        InitiatorName: INITIATOR,
        SecurityCredential: SECURITY_CREDENTIAL,
        CommandID: "BusinessPayment",
        Amount: Math.round(Number(amount)),
        PartyA: SHORTCODE,
        PartyB: phone,
        Remarks: (reason || `Welfare ${walletType} payout`).slice(0, 100),
        QueueTimeOutURL: timeoutUrl,
        ResultURL: callbackUrl,
        Occasion: walletType,
      };

      const res = await fetch(`${DARAJA_BASE}/mpesa/b2c/v3/paymentrequest`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      bankResponse = await res.json().catch(() => ({}));
      success = res.ok && (bankResponse?.ResponseCode === "0");
      if (!success) {
        errorMessage =
          bankResponse?.errorMessage ||
          bankResponse?.ResponseDescription ||
          `Daraja API ${res.status}`;
      }
    } else {
      errorMessage =
        "M-Pesa sandbox not configured (MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET).";
    }

    await supabase.from("b2c_transactions").insert({
      withdrawal_id: withdrawalId,
      mpesa_transaction_id: mpesaTransactionId,
      phone_number: phone,
      amount,
      status: success ? "initiated" : "failed",
      error_message: errorMessage,
    });

    return new Response(
      JSON.stringify({
        success,
        transactionId: mpesaTransactionId,
        message: success
          ? `Sandbox transfer of KES ${amount} initiated to ${phone}`
          : errorMessage,
        bank: bankResponse,
        walletType,
        sandbox: true,
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
