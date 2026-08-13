// Co-operative Bank STK Push (collection / C2B).
//
// Money is collected into TWO bank accounts:
//   - COOP_MAIN_ACCOUNT       -> monthly contributions
//   - COOP_COLLECTION_ACCOUNT -> penalties, fund drives, operational top-ups
//
// Secrets: COOP_CONSUMER_KEY, COOP_CONSUMER_SECRET, COOP_MAIN_ACCOUNT,
//          COOP_COLLECTION_ACCOUNT
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  COOP_STK_URL,
  callbackUrl,
  collectionAccount,
  coopConfigured,
  coopMessage,
  coopPost,
  coopSuccess,
  messageReference,
  normalizePhone,
  type WalletKind,
} from "../_shared/coop.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function resolveKind(input?: string): WalletKind {
  const v = (input || "").toLowerCase();
  if (v.startsWith("pen")) return "penalty";
  if (v.startsWith("don") || v.startsWith("fund")) return "donation";
  if (v.startsWith("op")) return "operational";
  return "contribution";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const {
      member_id,
      amount,
      phone: overridePhone,
      reference,
      wallet_type,
      paymentType,
      accountReference,
      transactionDesc,
    } = body || {};

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

    if (!coopConfigured()) {
      return new Response(
        JSON.stringify({
          setup_required: true,
          error:
            "Co-op Bank not configured. Add COOP_CONSUMER_KEY and COOP_CONSUMER_SECRET in backend secrets.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const kind = resolveKind(paymentType || wallet_type);
    const bankAccount = collectionAccount(kind);
    if (!bankAccount) {
      return new Response(
        JSON.stringify({
          setup_required: true,
          error:
            "Collection bank account not configured. Add COOP_MAIN_ACCOUNT and COOP_COLLECTION_ACCOUNT.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const msgRef = messageReference("STK");
    const txnRef =
      reference ||
      `KHCWW-${kind.slice(0, 3).toUpperCase()}-${
        member.member_id || member.id.slice(0, 8)
      }-${Date.now()}`;

    const payload = {
      MessageReference: msgRef,
      CallBackUrl: callbackUrl("coop-stk-callback"),
      MobileNumber: phone,
      Amount: Math.round(Number(amount)),
      AccountReference: String(
        accountReference || member.member_id || member.id.slice(0, 8),
      ).slice(0, 20),
      TransactionDescription: String(
        transactionDesc || `KHCWW ${kind} payment`,
      ).slice(0, 50),
      // Destination Co-op Bank account that receives the funds
      BankAccountNumber: bankAccount,
      Currency: "KES",
      Narration: `KHCWW ${kind} - ${member.name}`.slice(0, 60),
    };

    const { ok, status, data } = await coopPost(COOP_STK_URL, payload);
    const success = ok && coopSuccess(data);
    const checkoutId =
      data?.CheckoutRequestID ?? data?.TransactionID ?? data?.MessageReference ?? msgRef;

    await supabase.from("payments").insert({
      member_id: member.id,
      amount: Number(amount),
      transaction_ref: txnRef,
      raw_message:
        `Co-op Bank STK push (${kind}) to ${phone} into a/c ${bankAccount}: ` +
        (success ? "sent" : coopMessage(data) || `HTTP ${status}`),
      matched: false,
      source: `coop_stk_${kind}`,
      received_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        ok: success,
        message: success
          ? "Payment prompt sent to your phone. Enter your M-Pesa PIN to complete."
          : coopMessage(data),
        bank: {
          CheckoutRequestID: checkoutId,
          MessageReference: msgRef,
          ResponseCode: data?.MessageCode ?? data?.ResponseCode,
          ResponseDescription: coopMessage(data),
        },
        reference: txnRef,
        checkoutRequestId: checkoutId,
        account: bankAccount,
        walletType: kind,
        provider: "coop-bank",
      }),
      {
        status: success ? 200 : 400,
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
