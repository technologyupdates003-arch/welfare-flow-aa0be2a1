// filepath: supabase/functions/member-registration-callback/index.ts
// Handles M-Pesa STK Push callbacks for member registration payments

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface STKCallback {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value: any;
        }>;
      };
    };
  };
}

function extractCallbackData(metadata: any): Record<string, any> {
  const result: Record<string, any> = {};
  if (!metadata || !metadata.Item) return result;

  for (const item of metadata.Item) {
    if (item.Name === "Amount") result.Amount = item.Value;
    if (item.Name === "MpesaReceiptNumber") result.MpesaReceiptNumber = item.Value;
    if (item.Name === "TransactionDate") result.TransactionDate = item.Value;
    if (item.Name === "PhoneNumber") result.PhoneNumber = item.Value;
  }

  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const callback: STKCallback = await req.json();
    const { Body } = callback;
    const { stkCallback } = Body;

    console.log("Registration payment callback received:", {
      CheckoutRequestID: stkCallback.CheckoutRequestID,
      ResultCode: stkCallback.ResultCode,
    });

    // Result Code 0 = Success
    if (stkCallback.ResultCode !== 0) {
      // Payment failed - update fee record
      const { data: fee } = await supabase
        .from("registration_fees")
        .select("id, registration_id, retry_count")
        .eq("mpesa_checkout_request_id", stkCallback.CheckoutRequestID)
        .single();

      if (fee) {
        await supabase
          .from("registration_fees")
          .update({
            status: "failed",
            error_message: stkCallback.ResultDesc,
            last_retry_at: new Date().toISOString(),
            retry_count: (fee.retry_count || 0) + 1,
          })
          .eq("id", fee.id);

        // Update registration status
        await supabase
          .from("member_registrations")
          .update({ payment_status: "failed" })
          .eq("id", fee.registration_id);
      }

      return new Response(JSON.stringify({ success: false }), {
        status: 200, // Return 200 to M-Pesa
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Payment successful
    const callbackData = extractCallbackData(stkCallback.CallbackMetadata);
    const amount = callbackData.Amount;
    const mpesaRef = callbackData.MpesaReceiptNumber;
    const phone = callbackData.PhoneNumber;

    console.log("Payment successful:", { amount, mpesaRef, phone });

    // Find and update fee record
    const { data: fee } = await supabase
      .from("registration_fees")
      .select("id, registration_id")
      .eq("mpesa_checkout_request_id", stkCallback.CheckoutRequestID)
      .single();

    if (!fee) {
      console.error("Fee record not found for callback:", stkCallback.CheckoutRequestID);
      return new Response(JSON.stringify({ success: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update fee record
    await supabase
      .from("registration_fees")
      .update({
        status: "paid",
        mpesa_transaction_id: mpesaRef,
        verified_at: new Date().toISOString(),
      })
      .eq("id", fee.id);

    // Update registration status to verified
    const { error: updateError } = await supabase
      .from("member_registrations")
      .update({
        status: "verified",
        payment_status: "verified",
        verified_at: new Date().toISOString(),
      })
      .eq("id", fee.registration_id);

    if (updateError) {
      console.error("Error updating registration:", updateError);
    }

    // Get registration details for SMS
    const { data: registration } = await supabase
      .from("member_registrations")
      .select("id, phone_number, full_name")
      .eq("id", fee.registration_id)
      .single();

    // Check if auto-approve is enabled
    const { data: config } = await supabase
      .from("registration_config")
      .select("auto_approve")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (registration && config?.auto_approve) {
      // Auto-approve: generate access link + temp password and send setup SMS
      try {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let tempPassword = "";
        for (let i = 0; i < 12; i++) {
          tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const accessToken = `${registration.id}-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 15)}`;
        const systemLink = `${Deno.env.get("SYSTEM_URL") || SUPABASE_URL}/register/${accessToken}`;

        await supabase.from("registration_access_links").insert({
          registration_id: registration.id,
          access_token: accessToken,
          temporary_password: tempPassword,
        });

        await supabase
          .from("member_registrations")
          .update({
            status: "approved",
            approved_at: new Date().toISOString(),
            approval_notes: "Auto-approved after payment",
          })
          .eq("id", registration.id);

        await supabase.functions.invoke("send-bulk-sms", {
          body: {
            phones: [registration.phone_number],
            message: `Karibu ${registration.full_name}! Ombi lako limeidhinishwa. Ingia: ${systemLink}\nNeno la siri: ${tempPassword}`,
          },
        });
      } catch (autoErr) {
        console.error("Auto-approve error:", autoErr);
      }
    } else if (registration) {
      // Send SMS notification about payment verification (manual approval)
      try {
        await supabase.functions.invoke("send-sms", {
          body: {
            phone: registration.phone_number,
            message: `Asante ${registration.full_name}! Malipo yako yamethibitishwa. Utapata ujumbe wa kuingia kwenye mfumo hivi karibuni.`,
          },
        });
      } catch (smsErr) {
        console.error("SMS send error:", smsErr);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Callback processing error:", err);
    return new Response(JSON.stringify({ success: false }), {
      status: 200, // Return 200 to M-Pesa even on error
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
