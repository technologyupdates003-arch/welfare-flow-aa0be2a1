import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UNIVERSAL_PASSWORD = "Member2026";

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const cleaned = String(raw).replace(/\s+/g, "").replace(/-/g, "").replace(/\+/g, "");
  if (cleaned.startsWith("254") && cleaned.length === 12) return "+" + cleaned;
  if (cleaned.startsWith("0") && cleaned.length === 10) return "+254" + cleaned.slice(1);
  if (cleaned.startsWith("7") && cleaned.length === 9) return "+254" + cleaned;
  if (cleaned.startsWith("1") && cleaned.length === 9) return "+254" + cleaned;
  if (/^\d{9}$/.test(cleaned)) return "+254" + cleaned;
  return null;
}

interface IncomingRow {
  phone: string;
  name?: string;
  amount: number;
  date: string; // YYYY-MM-DD
  reference: string;
  mpesaCode?: string;
  rawDetails?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { rows } = await req.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: "No rows provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = {
      total: rows.length,
      new_members: 0,
      existing_members_updated: 0,
      duplicates_skipped: 0,
      transactions_imported: 0,
      total_amount: 0,
      failed: 0,
      failures: [] as { row: number; reason: string }[],
    };

    // Pre-fetch members for dedup/matching
    const { data: allMembers } = await supabase.from("members").select("id, phone");
    const memberMap = new Map((allMembers || []).map((m: any) => [m.phone, m.id]));

    // Track which members got new transactions (need recompute)
    const affectedMembers = new Set<string>();
    const existingUpdated = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 1;
      const row: IncomingRow = rows[i];
      try {
        const phone = normalizePhone(String(row.phone || ""));
        const amount = Number(row.amount);
        const dateStr = String(row.date || "").trim();
        const reference = String(row.reference || "").trim();

        if (!phone) { results.failures.push({ row: rowNum, reason: `Invalid phone: "${row.phone}"` }); results.failed++; continue; }
        if (isNaN(amount) || amount <= 0) { results.failures.push({ row: rowNum, reason: `Invalid amount: "${row.amount}"` }); results.failed++; continue; }
        if (!dateStr) { results.failures.push({ row: rowNum, reason: "Missing transaction date" }); results.failed++; continue; }
        if (!reference) { results.failures.push({ row: rowNum, reason: "Missing transaction reference" }); results.failed++; continue; }

        const parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) { results.failures.push({ row: rowNum, reason: `Invalid date: "${dateStr}"` }); results.failed++; continue; }

        const month = parsedDate.getMonth() + 1;
        const year = parsedDate.getFullYear();
        const txDate = parsedDate.toISOString().split("T")[0];
        const name = String(row.name || "").trim() || phone;

        // Duplicate prevention: phone + reference + date + amount
        const { data: existingTx } = await supabase
          .from("bank_transactions")
          .select("id")
          .eq("phone", phone)
          .eq("transaction_reference", reference)
          .eq("transaction_date", txDate)
          .eq("amount", amount)
          .maybeSingle();

        if (existingTx) { results.duplicates_skipped++; continue; }

        // Find or create member
        let memberId = memberMap.get(phone);
        if (!memberId) {
          const email = `${phone.replace("+", "")}@welfare.local`;
          const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
            email, password: UNIVERSAL_PASSWORD, email_confirm: true,
          });

          if (authErr && !authErr.message?.includes("already")) {
            throw new Error(authErr.message);
          }

          let userId = authData?.user?.id;
          if (!userId) {
            // Auth user already existed - look it up via listUsers
            const { data: list } = await supabase.auth.admin.listUsers();
            userId = list?.users?.find((u: any) => u.email === email)?.id;
          }

          const { data: newMember, error: memberErr } = await supabase
            .from("members")
            .insert({ name, phone, user_id: userId || null })
            .select("id")
            .single();
          if (memberErr) throw new Error(memberErr.message);

          if (userId) {
            await supabase.from("user_roles").insert({ user_id: userId, role: "member" });
          }

          memberId = newMember.id;
          memberMap.set(phone, memberId);
          results.new_members++;
        } else {
          existingUpdated.add(memberId);
        }

        // Insert the raw transaction
        const { error: txErr } = await supabase.from("bank_transactions").insert({
          member_id: memberId,
          phone,
          name,
          amount,
          transaction_date: txDate,
          month,
          year,
          transaction_reference: reference,
          mpesa_code: row.mpesaCode || null,
          raw_details: row.rawDetails || null,
        });
        if (txErr) {
          // Unique index race -> treat as duplicate
          if (txErr.message?.includes("duplicate") || txErr.code === "23505") {
            results.duplicates_skipped++;
            continue;
          }
          throw new Error(txErr.message);
        }

        affectedMembers.add(memberId);
        results.transactions_imported++;
        results.total_amount += amount;
      } catch (err: any) {
        results.failures.push({ row: rowNum, reason: err.message || "Unknown error" });
        results.failed++;
      }
    }

    results.existing_members_updated = existingUpdated.size;

    // Recompute monthly contribution aggregates + member totals for affected members
    for (const memberId of affectedMembers) {
      try {
        const { data: txs } = await supabase
          .from("bank_transactions")
          .select("amount, month, year, transaction_date")
          .eq("member_id", memberId);

        const monthly = new Map<string, { amount: number; month: number; year: number; lastDate: string }>();
        for (const t of txs || []) {
          const key = `${t.year}-${t.month}`;
          const cur = monthly.get(key) || { amount: 0, month: t.month, year: t.year, lastDate: t.transaction_date };
          cur.amount += Number(t.amount);
          if (t.transaction_date > cur.lastDate) cur.lastDate = t.transaction_date;
          monthly.set(key, cur);
        }

        let memberTotal = 0;
        for (const m of monthly.values()) {
          memberTotal += m.amount;
          const dueDate = `${m.year}-${String(m.month).padStart(2, "0")}-05`;
          await supabase.from("contributions").upsert(
            {
              member_id: memberId,
              amount: m.amount,
              month: m.month,
              year: m.year,
              due_date: dueDate,
              status: "paid",
              paid_date: m.lastDate,
            },
            { onConflict: "member_id,month,year" }
          );
        }

        await supabase.from("members").update({ total_contributions: memberTotal }).eq("id", memberId);
      } catch (err) {
        console.error("Recompute error for member", memberId, err);
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Bank statement import error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
