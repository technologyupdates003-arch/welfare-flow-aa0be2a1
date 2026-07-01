import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { normalizePhone, sendTalksasaSms } from "../_shared/talksasa.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phones, message } = await req.json();

    if (!phones?.length || !message) {
      return new Response(JSON.stringify({ error: "Missing phones or message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const recipients = Array.from(
      new Set(
        (phones as string[])
          .map(normalizePhone)
          .filter((p): p is string => !!p),
      ),
    );

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ error: "No valid phone numbers" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await sendTalksasaSms(recipients, message);

    const logs = recipients.map((phone) => ({
      recipient_phone: phone,
      message,
      status: result.status,
      provider_ref: (result.provider as any)?.data?.uid || (result.provider as any)?.uid || null,
    }));
    await supabase.from("sms_logs").insert(logs);

    // Always return 200 so the frontend can show a friendly toast instead of crashing.
    return new Response(
      JSON.stringify({
        status: result.status,
        count: recipients.length,
        provider: result.provider,
        error: result.error,
        insufficient_balance: result.insufficientBalance,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Bulk SMS error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
