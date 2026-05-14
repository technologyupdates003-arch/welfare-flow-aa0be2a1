import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ABANCOOL_URL = "https://hynoajfxknnudmziecua.supabase.co/functions/v1/send-sms";
const SENDER_ID = "ABAN_COOL";

// Normalize phones to 2547XXXXXXXX (no +, no leading 0)
function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  let p = String(raw).replace(/[^\d+]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("0")) p = "254" + p.slice(1);
  if (p.startsWith("7") || p.startsWith("1")) p = "254" + p;
  if (!p.startsWith("254") || p.length !== 12) return null;
  return p;
}

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

    const apiKey = Deno.env.get("ABANCOOL_SMS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ABANCOOL_SMS_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const resp = await fetch(ABANCOOL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipients,
        message,
        sender_id: SENDER_ID,
      }),
    });

    const text = await resp.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    const status = resp.ok ? "sent" : "failed";
    const logs = recipients.map((phone) => ({
      recipient_phone: phone,
      message,
      status,
      provider_ref: data?.message_id || data?.id || null,
    }));
    await supabase.from("sms_logs").insert(logs);

    return new Response(
      JSON.stringify({ status, count: recipients.length, provider: data }),
      {
        status: resp.ok ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Bulk SMS error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
