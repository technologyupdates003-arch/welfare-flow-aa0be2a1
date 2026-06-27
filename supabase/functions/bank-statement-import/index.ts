import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UNIVERSAL_PASSWORD = "Member2026";

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const cleaned = String(raw).replace(/\D/g, "");
  if (cleaned.startsWith("254") && cleaned.length === 12) return "+" + cleaned;
  if (cleaned.startsWith("0") && cleaned.length === 10) return "+254" + cleaned.slice(1);
  if ((cleaned.startsWith("7") || cleaned.startsWith("1")) && cleaned.length === 9) return "+254" + cleaned;
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

// Load ALL auth users into an email -> id map (paginated).
async function loadAuthUsers(supabase: any): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let page = 1;
  // perPage max is 1000
  for (; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    const users = data?.users || [];
    for (const u of users) if (u.email) map.set(u.email.toLowerCase(), u.id);
    if (users.length < 1000) break;
  }
  return map;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
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

    // ---- Pre-fetch everything we need (once) ----
    const authMap = await loadAuthUsers(supabase);
    const { data: allMembers } = await supabase.from("members").select("id, phone, user_id");
    const memberMap = new Map<string, { id: string; user_id: string | null }>(
      (allMembers || []).map((m: any) => {
        const normalizedPhone = normalizePhone(String(m.phone || ""));
        return [normalizedPhone || String(m.phone || ""), { id: m.id, user_id: m.user_id }];
      })
    );

    // Keep existing members linked to auth users by phone when possible
    for (const member of allMembers || []) {
      if (!member.user_id && member.phone) {
        const email = `${member.phone.replace(/\D/g, "")}@welfare.local`.toLowerCase();
        const userId = authMap.get(email);
        if (userId) {
          await supabase.from("members").update({ user_id: userId }).eq("id", member.id);
          memberMap.set(member.phone, { id: member.id, user_id: userId });
          authMap.set(email, userId);
          await supabase.from("user_roles").upsert(
            { user_id: userId, role: "member" },
            { onConflict: ["user_id", "role"], ignoreDuplicates: true }
          );
        }
      }
    }

    // Existing dedup keys for transactions already in the DB
    const { data: existingTx } = await supabase
      .from("bank_transactions")
      .select("phone, transaction_reference, transaction_date, amount");
    const existingKeys = new Set<string>(
      (existingTx || []).map(
        (t: any) => `${t.phone}|${t.transaction_reference}|${t.transaction_date}|${Number(t.amount)}`
      )
    );

    // ---- Normalise + validate incoming rows ----
    interface CleanRow {
      rowNum: number;
      phone: string;
      name: string;
      amount: number;
      date: string;
      month: number;
      year: number;
      reference: string;
      mpesaCode: string | null;
      rawDetails: string | null;
      key: string;
    }

    const clean: CleanRow[] = [];
    const seenInBatch = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 1;
      const row: IncomingRow = rows[i];
      const phone = normalizePhone(String(row.phone || ""));
      const amount = Number(row.amount);
      const dateStr = String(row.date || "").trim();
      let reference = String(row.reference || "").trim();

      if (!phone) { results.failures.push({ row: rowNum, reason: `Invalid phone: "${row.phone}"` }); results.failed++; continue; }
      if (isNaN(amount) || amount <= 0) { results.failures.push({ row: rowNum, reason: `Invalid amount: "${row.amount}"` }); results.failed++; continue; }
      if (!dateStr) { results.failures.push({ row: rowNum, reason: "Missing transaction date" }); results.failed++; continue; }

      const parsedDate = new Date(dateStr);
      if (isNaN(parsedDate.getTime())) { results.failures.push({ row: rowNum, reason: `Invalid date: "${dateStr}"` }); results.failed++; continue; }

      const txDate = parsedDate.toISOString().split("T")[0];
      if (!reference) reference = `${phone}-${txDate}-${amount}`;

      const key = `${phone}|${reference}|${txDate}|${amount}`;
      // Duplicate against DB or within this batch
      if (existingKeys.has(key) || seenInBatch.has(key)) { results.duplicates_skipped++; continue; }
      seenInBatch.add(key);

      clean.push({
        rowNum,
        phone,
        name: String(row.name || "").trim() || phone,
        amount,
        date: txDate,
        month: parsedDate.getMonth() + 1,
        year: parsedDate.getFullYear(),
        reference,
        mpesaCode: row.mpesaCode || null,
        rawDetails: row.rawDetails || null,
        key,
      });
    }

    // ---- Create missing members in bulk ----
    const neededPhones = new Map<string, string>(); // phone -> name
    for (const c of clean) {
      if (!memberMap.has(c.phone) && !neededPhones.has(c.phone)) neededPhones.set(c.phone, c.name);
    }

    if (neededPhones.size > 0) {
      const authMap = await loadAuthUsers(supabase);

      for (const [phone, name] of neededPhones) {
        try {
          const email = `${phone.replace("+", "")}@welfare.local`;
          let userId = authMap.get(email.toLowerCase());

          if (!userId) {
            const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
              email, password: UNIVERSAL_PASSWORD, email_confirm: true,
            });
            if (authErr && !String(authErr.message || "").toLowerCase().includes("already")) {
              throw new Error(authErr.message);
            }
            userId = authData?.user?.id || authMap.get(email.toLowerCase());
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

          memberMap.set(phone, { id: newMember.id, user_id: userId || null });
          results.new_members++;
        } catch (err: any) {
          // Mark all rows for this phone as failed
          for (const c of clean) {
            if (c.phone === phone) { results.failures.push({ row: c.rowNum, reason: `Member create failed: ${err.message}` }); results.failed++; }
          }
        }
      }
    }

    // ---- Bulk insert transactions ----
    const insertable = clean
      .filter((c) => memberMap.has(c.phone))
      .map((c) => {
        const member = memberMap.get(c.phone)!;
        return {
          member_id: member.id,
          phone: c.phone,
          name: c.name,
          amount: c.amount,
          transaction_date: c.date,
          month: c.month,
          year: c.year,
          transaction_reference: c.reference,
          mpesa_code: c.mpesaCode,
          raw_details: c.rawDetails,
        };
      });

    const affectedMembers = new Set<string>();
    const existingMembersTouched = new Set<string>();
    for (const c of clean) {
      const member = memberMap.get(c.phone);
      if (!member) continue;
      affectedMembers.add(member.id);
      if (!neededPhones.has(c.phone)) existingMembersTouched.add(member.id);
    }

    for (const batch of chunk(insertable, 500)) {
      const { error: txErr } = await supabase
        .from("bank_transactions")
        .upsert(batch, { onConflict: "phone,transaction_reference,transaction_date,amount", ignoreDuplicates: true });
      if (txErr) {
        // Fall back to per-row insert so one bad row doesn't drop the whole batch
        for (const rec of batch) {
          const { error: oneErr } = await supabase.from("bank_transactions").insert(rec);
          if (oneErr) {
            if (oneErr.code === "23505" || String(oneErr.message || "").includes("duplicate")) {
              results.duplicates_skipped++;
            } else {
              results.failed++;
              results.failures.push({ row: 0, reason: `Insert failed (${rec.phone}): ${oneErr.message}` });
            }
          } else {
            results.transactions_imported++;
            results.total_amount += Number(rec.amount);
          }
        }
      } else {
        results.transactions_imported += batch.length;
        for (const rec of batch) results.total_amount += Number(rec.amount);
      }
    }

    results.existing_members_updated = existingMembersTouched.size;

    // ---- Recompute aggregates for affected members (bulk per member) ----
    const affectedIds = [...affectedMembers];
    console.log(`[DEBUG] Affected member IDs for recompute: ${affectedIds.length}`);
    for (const idsChunk of chunk(affectedIds, 50)) {
      const { data: txs } = await supabase
        .from("bank_transactions")
        .select("member_id, amount, month, year, transaction_date")
        .in("member_id", idsChunk);

      console.log(`[DEBUG] Fetched ${txs?.length || 0} transactions for chunk of ${idsChunk.length} members`);

      const byMember = new Map<string, any[]>();
      for (const t of txs || []) {
        const arr = byMember.get(t.member_id) || [];
        arr.push(t);
        byMember.set(t.member_id, arr);
      }

      for (const memberId of idsChunk) {
        try {
          const list = byMember.get(memberId) || [];
          console.log(`[DEBUG] Member ${memberId}: ${list.length} transactions`);
          const monthly = new Map<string, { amount: number; month: number; year: number; lastDate: string }>();
          for (const t of list) {
            const k = `${t.year}-${t.month}`;
            const cur = monthly.get(k) || { amount: 0, month: t.month, year: t.year, lastDate: t.transaction_date };
            cur.amount += Number(t.amount);
            if (t.transaction_date > cur.lastDate) cur.lastDate = t.transaction_date;
            monthly.set(k, cur);
          }

          let memberTotal = 0;
          const contribRows = [];
          for (const m of monthly.values()) {
            memberTotal += m.amount;
            contribRows.push({
              member_id: memberId,
              amount: m.amount,
              month: m.month,
              year: m.year,
              due_date: `${m.year}-${String(m.month).padStart(2, "0")}-05`,
              status: "paid",
              paid_date: m.lastDate,
            });
          }
          if (contribRows.length) {
            console.log(`[DEBUG] Upserting ${contribRows.length} contribution rows for member ${memberId}`);
            const { error: upsertErr } = await supabase.from("contributions").upsert(contribRows, { onConflict: "member_id,month,year" });
            if (upsertErr) {
              console.error(`[DEBUG] Upsert error for member ${memberId}:`, upsertErr);
            }
          }
          const { error: updateErr } = await supabase.from("members").update({ total_contributions: memberTotal }).eq("id", memberId);
          if (updateErr) {
            console.error(`[DEBUG] Update error for member ${memberId}:`, updateErr);
          }
        } catch (err) {
          console.error("Recompute error for member", memberId, err);
        }
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
