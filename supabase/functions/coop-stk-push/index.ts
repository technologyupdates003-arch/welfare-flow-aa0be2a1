// Safaricom Daraja SANDBOX STK Push (Lipa Na M-Pesa Online).
// Used for both penalty and donation member contributions in test mode.
// Required secrets: MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET
// Sandbox public defaults are used for shortcode/passkey when not overridden.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DARAJA_BASE =
  Deno.env.get("MPESA_BASE_URL") ?? "https://sandbox.safaricom.co.ke";
// Safaricom public sandbox defaults
const SANDBOX_SHORTCODE = "174379";
const SANDBOX_PASSKEY =
  "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";

function normalizePhone(p: string): string {
  const digits = (p || "").replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return "254" + digits.slice(1);
  if (digits.startsWith("7") || digits.startsWith("1")) return "254" + digits;
  return digits;
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

async function getToken(key: string, secret: string): Promise<string> {
  const auth = btoa(`${key}:${secret}`);
  const res = await fetch(
    `${DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials`,
    { method: "GET", headers: { Authorization: `Basic ${auth}` } },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Daraja token failed (${res.status}): ${t}`);
  }
  const data = await res.json();
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const { member_id, amount, phone: overridePhone, reference, wallet_type } = body || {};

    if (!member_id || !amount || Number(amount) <= 0) {
      return new Response(
        JSON.stringify({ error: "member_id and positive amount are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: member, error: mErr } = await supabase
      .from("members")
      .select("id, name, phone, member_id")
      .eq("id", member_id)
      .single();
    if (mErr || !member) {
      return new Response(JSON.stringify({ error: "Member not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = normalizePhone(overridePhone || member.phone);
    if (!phone || phone.length < 12) {
      return new Response(
        JSON.stringify({ error: "Invalid phone number for STK push" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const KEY = Deno.env.get("MPESA_CONSUMER_KEY");
    const SECRET = Deno.env.get("MPESA_CONSUMER_SECRET");
    if (!KEY || !SECRET) {
      return new Response(
        JSON.stringify({
          setup_required: true,
          error:
            "M-Pesa sandbox not configured. Add MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET in backend secrets.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const SHORTCODE = Deno.env.get("MPESA_STK_SHORTCODE") ?? SANDBOX_SHORTCODE;
    const PASSKEY = Deno.env.get("MPESA_STK_PASSKEY") ?? SANDBOX_PASSKEY;

    const token = await getToken(KEY, SECRET);
    const ts = timestamp();
    const password = btoa(`${SHORTCODE}${PASSKEY}${ts}`);
    const txnRef =
      reference ||
      `WLF-${(wallet_type || "PEN").toString().slice(0, 3).toUpperCase()}-${
        member.member_id || member.id.slice(0, 8)
      }-${Date.now()}`;
    const callbackUrl =
      Deno.env.get("MPESA_STK_CALLBACK_URL") ??
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/coop-stk-callback`;

    const stkRes = await fetch(`${DARAJA_BASE}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: SHORTCODE,
        Password: password,
        Timestamp: ts,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.round(Number(amount)),
        PartyA: phone,
        PartyB: SHORTCODE,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: (member.member_id || member.id.slice(0, 8)).toString().slice(0, 12),
        TransactionDesc: `Welfare ${wallet_type || "contribution"}`.slice(0, 13),
      }),
    });

    const stkData = await stkRes.json().catch(() => ({}));
    const ok = stkRes.ok && stkData?.ResponseCode === "0";

    await supabase.from("payments").insert({
      member_id: member.id,
      amount: Number(amount),
      transaction_ref: txnRef,
      raw_message: `Daraja STK push (${wallet_type || "penalty"}) to ${phone}: ${stkData?.ResponseDescription || stkData?.errorMessage || "sent"}`,
      matched: false,
      source: `mpesa_stk_${wallet_type || "penalty"}`,
      received_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        ok,
        message: ok
          ? "Payment prompt sent to your phone. Enter your M-Pesa PIN to complete."
          : stkData?.errorMessage || stkData?.ResponseDescription || "Failed to initiate payment",
        bank: {
          CheckoutRequestID: stkData?.CheckoutRequestID,
          MerchantRequestID: stkData?.MerchantRequestID,
          ResponseCode: stkData?.ResponseCode,
          ResponseDescription: stkData?.ResponseDescription,
        },
        reference: txnRef,
        ResponseCode: stkData?.ResponseCode,
        ResponseDescription: stkData?.ResponseDescription,
        sandbox: true,
      }),
      {
        status: ok ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
