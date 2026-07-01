import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { normalizePhone, sendTalksasaSms } from "../_shared/talksasa.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    if (!Deno.env.get("TALKSASA_API_TOKEN")) throw new Error("TALKSASA_API_TOKEN not configured");

    const today = new Date();
    const in3 = new Date(today); in3.setDate(in3.getDate() + 3);
    const in1 = new Date(today); in1.setDate(in1.getDate() + 1);

    const targetDates = [
      { date: isoDate(today), label: "is due today" },
      { date: isoDate(in1), label: "is due tomorrow" },
      { date: isoDate(in3), label: "is due in 3 days" },
    ];

    let sent = 0;
    const results: any[] = [];

    for (const { date, label } of targetDates) {
      const { data: contribs } = await supabase
        .from("contributions")
        .select("id, amount, due_date, member_id, members!inner(name, phone, is_active)")
        .eq("status", "pending")
        .eq("due_date", date);

      for (const c of contribs || []) {
        const m: any = (c as any).members;
        if (!m?.is_active) continue;
        const phone = normalizePhone(m.phone);
        if (!phone) continue;

        const message = `Hi ${m.name}, your welfare contribution of KES ${Number(c.amount).toLocaleString()} ${label} (${date}). Please pay on time to avoid penalties. Thank you.`;

        try {
          const res = await sendTalksasaSms([phone], message);
          if (res.ok) sent++;
          results.push({ phone, date, ok: res.ok, error: res.error });
        } catch (e) {
          results.push({ phone, date, error: (e as Error).message });
        }
      }
    }

    return new Response(JSON.stringify({ status: "success", sent, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-due-reminders error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
