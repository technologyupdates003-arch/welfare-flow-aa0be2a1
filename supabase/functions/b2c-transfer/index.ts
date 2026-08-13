// Co-operative Bank payout (funds transfer / B2C).
//
// Pays out approved withdrawals from the penalty, fund-drive (donation) or
// operational wallet to a member's M-Pesa number, debiting the Co-op Bank
// account configured for that wallet. Safaricom Daraja is no longer used.
//
// Secrets: COOP_CONSUMER_KEY, COOP_CONSUMER_SECRET, COOP_MAIN_ACCOUNT,
//          COOP_COLLECTION_ACCOUNT, optional COOP_PAYOUT_ACCOUNT

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  COOP_FT_URL,
  callbackUrl,
  coopConfigured,
  coopMessage,
  coopPost,
  coopSuccess,
  messageReference,
  normalizePhone,
  payoutAccount,
  type WalletKind,
} from "../_shared/coop.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface PayoutRequest {
  withdrawalId: string;
  amount: number;
  phoneNumber: string;
  reason: string;
  adminName?: string;
  recipientName?: string;
  walletType?: "penalty" | "donation" | "operational";
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const WALLETS = {
  penalty: {
    withdrawalTable: "penalty_withdrawals",
    walletTable: "penalty_wallet",
    paymentTable: "penalty_payment_records",
    updatedAtField: "last_updated",
  },
  donation: {
    withdrawalTable: "donation_withdrawals",
    walletTable: "donation_wallet",
    paymentTable: "donation_payment_records",
    updatedAtField: "updated_at",
  },
  operational: {
    withdrawalTable: "operational_withdrawals",
    walletTable: "operational_wallet",
    paymentTable: "operational_payment_records",
    updatedAtField: "updated_at",
  },
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = (await req.json()) as PayoutRequest;
    const {
      withdrawalId,
      amount,
      phoneNumber,
      reason,
      recipientName,
      walletType = "penalty",
    } = body;

    if (!withdrawalId || !amount || !phoneNumber) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cfg = WALLETS[walletType as keyof typeof WALLETS] ?? WALLETS.penalty;
    const { withdrawalTable, walletTable, paymentTable, updatedAtField } = cfg;

    // Idempotency: never send the same withdrawal twice.
    const { data: existingTransaction } = await supabase
      .from("b2c_transactions")
      .select("mpesa_transaction_id, status")
      .eq("withdrawal_id", withdrawalId)
      .in("status", ["initiated", "completed"])
      .order("initiated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingTransaction) {
      return new Response(
        JSON.stringify({
          success: true,
          transactionId: existingTransaction.mpesa_transaction_id,
          message: "This withdrawal has already been sent to the bank for processing.",
          walletType,
          duplicate: true,
          provider: "coop-bank",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const phone = normalizePhone(phoneNumber);
    const sourceAccount = payoutAccount(walletType as WalletKind);

    let bankResponse: any = null;
    let success = false;
    let errorMessage: string | null = null;
    const originatorRef = messageReference("PAY");
    let bankReceipt: string | null = null;
    let bankCharge = 0;

    if (!coopConfigured()) {
      errorMessage =
        "Co-op Bank not configured (COOP_CONSUMER_KEY / COOP_CONSUMER_SECRET).";
    } else if (!sourceAccount) {
      errorMessage =
        "Payout bank account not configured (COOP_PAYOUT_ACCOUNT / COOP_COLLECTION_ACCOUNT).";
    } else {
      const payload = {
        MessageReference: originatorRef,
        CallBackUrl: callbackUrl("coop-transfer-callback"),
        SourceAccount: sourceAccount,
        Amount: Math.round(Number(amount)),
        Currency: "KES",
        // Destination: mobile money (M-Pesa) wallet
        DestinationType: "MOBILE",
        DestinationAccount: phone,
        DestinationName: (recipientName || "KHCWW Member").slice(0, 60),
        Narration: (reason || `KHCWW ${walletType} payout`).slice(0, 100),
        Reference: withdrawalId,
      };

      const res = await coopPost(COOP_FT_URL, payload);
      bankResponse = res.data;
      success = res.ok && coopSuccess(res.data);
      bankReceipt =
        res.data?.TransactionReference ??
        res.data?.TransactionID ??
        res.data?.ThirdPartyTransactionID ??
        null;
      bankCharge = Number(res.data?.Charge ?? res.data?.TransactionFee ?? 0) || 0;
      if (!success) errorMessage = coopMessage(res.data) || `Co-op API ${res.status}`;
    }

    const transactionId = bankReceipt ?? originatorRef;

    await supabase.from("b2c_transactions").insert({
      withdrawal_id: withdrawalId,
      mpesa_transaction_id: transactionId,
      phone_number: phone,
      amount,
      mpesa_charge: bankCharge,
      wallet_type: walletType,
      status: success ? "completed" : "failed",
      completed_at: success ? new Date().toISOString() : null,
      transaction_completed_at: success ? new Date().toISOString() : null,
      error_message: errorMessage,
    });

    if (success) {
      const submittedAt = new Date().toISOString();

      await supabase
        .from(withdrawalTable)
        .update({ status: "completed", submitted_at: submittedAt })
        .eq("id", withdrawalId);

      const [{ data: verifiedPayments }, { data: completedWithdrawals }, { data: walletRow }] =
        await Promise.all([
          supabase.from(paymentTable).select("amount").eq("status", "verified"),
          supabase.from(withdrawalTable).select("amount").eq("status", "completed"),
          supabase.from(walletTable).select("id").limit(1).maybeSingle(),
        ]);

      const totalReceived = (verifiedPayments || []).reduce(
        (sum, row) => sum + Number(row.amount || 0), 0);
      const totalWithdrawn = (completedWithdrawals || []).reduce(
        (sum, row) => sum + Number(row.amount || 0), 0);

      if (walletRow?.id) {
        await supabase.from(walletTable).update({
          total_received: totalReceived,
          total_withdrawn: totalWithdrawn,
          total_balance: totalReceived - totalWithdrawn,
          [updatedAtField]: submittedAt,
        }).eq("id", walletRow.id);
      }

      // Unified ledger so statements + reports stay in sync.
      await supabase.from("wallet_transactions").insert({
        wallet_type: walletType,
        direction: "out",
        source: "b2c",
        reference_id: withdrawalId,
        reference_table: withdrawalTable,
        party_name: recipientName ?? null,
        party_phone: phone,
        gross_amount: amount,
        mpesa_charge: bankCharge,
        net_amount: Number(amount) + bankCharge,
        mpesa_receipt: transactionId,
        status: "completed",
        notes: reason ?? null,
      });
    }

    return new Response(
      JSON.stringify({
        success,
        transactionId,
        message: success
          ? `Co-op Bank transfer of KES ${amount} initiated to ${phone}`
          : errorMessage,
        bank: bankResponse,
        walletType,
        sourceAccount,
        provider: "coop-bank",
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
