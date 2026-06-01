import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // 1. Get settings
    const { data: settings } = await supabase
      .from("welfare_settings")
      .select("*")
      .single();

    if (!settings) {
      return new Response(JSON.stringify({ error: "No settings configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { monthly_contribution_amount, contribution_due_day, penalty_amount, penalty_grace_days } = settings;

    // 2. Get all active members
    const { data: members } = await supabase
      .from("members")
      .select("id, user_id")
      .eq("is_active", true);

    if (!members || members.length === 0) {
      return new Response(JSON.stringify({ status: "no_members" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let generated = 0;
    let overdueMarked = 0;
    let penaltiesApplied = 0;
    let archivedEvents = 0;
    let archivedNews = 0;

    // 0. Auto-archive events & news whose scheduled (or rescheduled) end date has passed.
    // This makes them "disappear for good" once their date arrives.
    const nowIso = now.toISOString();
    try {
      const { data: activeEvents } = await supabase
        .from("events")
        .select("id, scheduled_date, rescheduled_date")
        .eq("status", "active");
      const expiredEventIds = (activeEvents || [])
        .filter((e: any) => {
          const end = e.rescheduled_date || e.scheduled_date;
          return end && new Date(end) < now;
        })
        .map((e: any) => e.id);
      if (expiredEventIds.length) {
        await supabase.from("events").update({ status: "archived" }).in("id", expiredEventIds);
        archivedEvents = expiredEventIds.length;
      }

      const { data: activeNews } = await supabase
        .from("news")
        .select("id, scheduled_date, rescheduled_date")
        .eq("status", "active");
      const expiredNewsIds = (activeNews || [])
        .filter((n: any) => {
          const end = n.rescheduled_date || n.scheduled_date;
          return end && new Date(end) < now;
        })
        .map((n: any) => n.id);
      if (expiredNewsIds.length) {
        await supabase.from("news").update({ status: "archived" }).in("id", expiredNewsIds);
        archivedNews = expiredNewsIds.length;
      }
    } catch (e) {
      console.error("Archival error:", e);
    }

    for (const member of members) {
      // 3. Auto-generate current month contribution if not exists
      const dueDate = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(contribution_due_day).padStart(2, "0")}`;
      
      const { data: existing } = await supabase
        .from("contributions")
        .select("id")
        .eq("member_id", member.id)
        .eq("month", currentMonth)
        .eq("year", currentYear)
        .maybeSingle();

      if (!existing) {
        await supabase.from("contributions").insert({
          member_id: member.id,
          amount: monthly_contribution_amount,
          month: currentMonth,
          year: currentYear,
          due_date: dueDate,
          status: "pending",
        });
        generated++;
      }

      // 4. Check all pending contributions - mark overdue if past due + grace
      const { data: pendingContribs } = await supabase
        .from("contributions")
        .select("id, due_date, member_id")
        .eq("member_id", member.id)
        .eq("status", "pending");

      for (const contrib of (pendingContribs || [])) {
        const dueWithGrace = new Date(contrib.due_date);
        dueWithGrace.setDate(dueWithGrace.getDate() + penalty_grace_days);

        if (now > dueWithGrace) {
          // Mark as overdue
          await supabase.from("contributions").update({ status: "overdue" }).eq("id", contrib.id);
          overdueMarked++;

          // Check if penalty already exists
          const { data: existingPenalty } = await supabase
            .from("penalties")
            .select("id")
            .eq("contribution_id", contrib.id)
            .maybeSingle();

          if (!existingPenalty) {
            await supabase.from("penalties").insert({
              member_id: contrib.member_id,
              contribution_id: contrib.id,
              amount: penalty_amount,
              reason: "Late payment",
            });
            penaltiesApplied++;

            // Update member penalty totals
            const { data: penaltyData } = await supabase
              .from("penalties")
              .select("amount")
              .eq("member_id", member.id)
              .eq("is_paid", false);
            const penaltyTotal = (penaltyData || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
            await supabase.from("members").update({ total_penalties: penaltyTotal }).eq("id", member.id);

            // Notify member
            if (member.user_id) {
              await supabase.from("notifications").insert({
                user_id: member.user_id,
                title: "Overdue Contribution",
                message: `Your contribution is overdue. A penalty of KES ${penalty_amount} has been applied.`,
                type: "warning",
              });
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({
      status: "success",
      generated,
      overdueMarked,
      penaltiesApplied,
      archivedEvents,
      archivedNews,
      membersProcessed: members.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Daily automation error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
