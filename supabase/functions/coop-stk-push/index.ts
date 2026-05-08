// Co-operative Bank STK Push (M-Pesa prompt) for member contributions
// Requires secrets: COOP_CONSUMER_KEY, COOP_CONSUMER_SECRET, COOP_ACCOUNT_NUMBER,
// COOP_STK_SHORTCODE, COOP_STK_PASSKEY (optional, defaults to sandbox)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const COOP_BASE =
  Deno.env.get("COOP_BANK_BASE_URL") ?? "https://developer.co-opbank.co.ke:8243";

function normalizePhone(p: string): string {
  const digits = (p || "").replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return "254" + digits.slice(1);
  if (digits.startsWith("7") || digits.startsWith("1")) return "254" + digits;
  return digits;
}

async function getToken(key: string, secret: string): Promise<string> {
  const auth = btoa(`${key}:${secret}`);
  const res = await fetch(`${COOP_BASE}/token?grant_type=client_credentials`, {
    method: "GET",
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
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
    const { member_id, amount, phone: overridePhone, reference } = body || {};

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

    const KEY = Deno.env.get("COOP_CONSUMER_KEY");
    const SECRET = Deno.env.get("COOP_CONSUMER_SECRET");
    const ACCOUNT = Deno.env.get("COOP_ACCOUNT_NUMBER");
    const SHORTCODE = Deno.env.get("COOP_STK_SHORTCODE");

    if (!KEY || !SECRET || !ACCOUNT || !SHORTCODE) {
      return new Response(
        JSON.stringify({
          setup_required: true,
          error:
            "Bank STK Push not configured. Add COOP_CONSUMER_KEY, COOP_CONSUMER_SECRET, COOP_ACCOUNT_NUMBER, COOP_STK_SHORTCODE in backend secrets.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = await getToken(KEY, SECRET);
    const txnRef = reference || `WLF-${member.member_id || member.id.slice(0, 8)}-${Date.now()}`;

    const stkRes = await fetch(`${COOP_BASE}/MpesaSTKPush/1.0.0/v1/stkpush`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        MerchantCode: SHORTCODE,
        NetworkCode: "63902",
        PhoneNumber: phone,
        TransactionDesc: `Welfare contribution - ${member.name}`,
        AccountReference: member.member_id || member.id.slice(0, 8),
        Currency: "KES",
        Amount: String(amount),
        CallBackURL: `${Deno.env.get("SUPABASE_URL")}/functions/v1/coop-stk-callback`,
        TransactionType: "CustomerPayBillOnline",
      }),
    });

    const stkData = await stkRes.json().catch(() => ({}));

    // Log the request in unmatched_payments for tracking until callback resolves it
    await supabase.from("payments").insert({
      member_id: member.id,
      amount: Number(amount),
      transaction_ref: txnRef,
      raw_message: `STK push initiated to ${phone}`,
      matched: false,
      source: "coop_stk",
      received_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        ok: stkRes.ok,
        message: stkRes.ok
          ? "Payment prompt sent to your phone. Enter your M-Pesa PIN to complete."
          : stkData?.message || "Failed to initiate payment",
        bank: stkData,
        reference: txnRef,
      }),
      {
        status: stkRes.ok ? 200 : 400,
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
