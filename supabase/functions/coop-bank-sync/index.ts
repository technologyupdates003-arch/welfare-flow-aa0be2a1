const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const COOP_TOKEN_URL = "https://developer.co-opbank.co.ke:8243/token";
const COOP_TRANSACTIONS_URL = "https://developer.co-opbank.co.ke:8243/Enquiry/AccountTransactions/1.0.0/Account";

interface CoopTransaction {
  TransactionDate: string;
  ValueDate: string;
  Narration: string;
  TransactionType: string;
  ServicePoint: string;
  TransactionReference: string;
  CreditAmount: string;
  DebitAmount: string;
  RunningClearedBalance: string;
  RunningBookBalance: string;
}

interface CoopResponse {
  MessageReference: string;
  MessageDateTime: string;
  MessageCode: string;
  MessageDescription: string;
  AccountNumber: string;
  AccountName: string;
  NoOfTransactions: string;
  TotalCredits: string;
  TotalDebits: string;
  Transactions: CoopTransaction[];
}

async function getCoopToken(consumerKey: string, consumerSecret: string): Promise<string> {
  const credentials = btoa(`${consumerKey}:${consumerSecret}`);
  
  const response = await fetch(COOP_TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token request failed: ${response.status} - ${text}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error("No access_token in response");
  }
  return data.access_token;
}

async function fetchTransactions(token: string, accountNumber: string, noOfTransactions: string): Promise<CoopResponse> {
  const messageReference = crypto.randomUUID().replace(/-/g, "").substring(0, 20);

  const response = await fetch(COOP_TRANSACTIONS_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      MessageReference: messageReference,
      AccountNumber: accountNumber,
      NoOfTransactions: noOfTransactions,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Transaction fetch failed: ${response.status} - ${text}`);
  }

  return await response.json();
}

function normalizePhone(phone: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+254${digits.substring(1)}`;
  if (digits.startsWith("7") && digits.length === 9) return `+254${digits}`;
  return null;
}

function extractPhoneFromNarration(narration: string): string | null {
  // Try to find phone patterns in narration: 07xx, 254xx, +254xx
  const patterns = [
    /(?:0[17]\d{8})/,
    /(?:254[17]\d{8})/,
    /(?:\+254[17]\d{8})/,
  ];
  for (const p of patterns) {
    const match = narration.match(p);
    if (match) return normalizePhone(match[0]);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const consumerKey = Deno.env.get("COOP_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("COOP_CONSUMER_SECRET");
    const accountNumber = Deno.env.get("COOP_ACCOUNT_NUMBER") || "01134568843700";

    if (!consumerKey || !consumerSecret) {
      return new Response(
        JSON.stringify({ 
          error: "Co-op Bank API credentials not configured",
          setup_required: true,
          message: "Please configure COOP_CONSUMER_KEY and COOP_CONSUMER_SECRET secrets" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse request body for optional params
    let noOfTransactions = "50";
    try {
      const body = await req.json();
      if (body.noOfTransactions) noOfTransactions = String(body.noOfTransactions);
    } catch {
      // No body, use defaults
    }

    // Step 1: Get OAuth token
    const token = await getCoopToken(consumerKey, consumerSecret);

    // Step 2: Fetch recent transactions
    const txnResponse = await fetchTransactions(token, accountNumber, noOfTransactions);

    if (txnResponse.MessageCode !== "0") {
      return new Response(
        JSON.stringify({ error: "Bank API error", details: txnResponse.MessageDescription }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Process only CREDIT transactions (money coming in)
    const credits = (txnResponse.Transactions || []).filter(
      (t) => t.TransactionType === "C" && parseFloat(t.CreditAmount) > 0
    );

    // Step 4: Get all members for matching
    const { data: members } = await supabase.from("members").select("id, name, phone, member_id");
    const memberList = members || [];

    // Step 5: Get existing transaction refs to avoid duplicates
    const existingRefs = new Set<string>();
    if (credits.length > 0) {
      const refs = credits.map((c) => c.TransactionReference);
      const { data: existingPayments } = await supabase
        .from("payments")
        .select("transaction_ref")
        .in("transaction_ref", refs);
      (existingPayments || []).forEach((p: any) => existingRefs.add(p.transaction_ref));
    }

    let processed = 0;
    let matched = 0;
    let unmatched = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const txn of credits) {
      // Skip already processed transactions
      if (existingRefs.has(txn.TransactionReference)) {
        skipped++;
        continue;
      }

      const amount = parseFloat(txn.CreditAmount);
      const narration = txn.Narration || "";

      // Try to match to a member:
      // 1. By phone in narration
      // 2. By name in narration
      // 3. By member_id in narration
      let matchedMember: any = null;

      // Try phone matching
      const phone = extractPhoneFromNarration(narration);
      if (phone) {
        matchedMember = memberList.find((m: any) => m.phone === phone);
      }

      // Try name matching (fuzzy - check if any member name appears in narration)
      if (!matchedMember) {
        const upperNarration = narration.toUpperCase();
        for (const m of memberList) {
          const nameParts = (m.name as string).toUpperCase().split(" ");
          // Match if at least 2 name parts found in narration (to avoid false positives)
          const matchCount = nameParts.filter((part: string) => part.length > 2 && upperNarration.includes(part)).length;
          if (matchCount >= 2 || (nameParts.length === 1 && matchCount === 1)) {
            matchedMember = m;
            break;
          }
        }
      }

      // Try member_id matching
      if (!matchedMember) {
        for (const m of memberList) {
          if (m.member_id && narration.includes(m.member_id)) {
            matchedMember = m;
            break;
          }
        }
      }

      // Insert payment record
      const { data: payment, error: paymentError } = await supabase.from("payments").insert({
        amount,
        transaction_ref: txn.TransactionReference,
        raw_message: narration,
        source: "coop_bank",
        matched: !!matchedMember,
        member_id: matchedMember?.id || null,
        received_at: txn.TransactionDate || new Date().toISOString(),
      }).select("id").single();

      if (paymentError) {
        results.push({ ref: txn.TransactionReference, error: paymentError.message });
        continue;
      }

      processed++;

      if (matchedMember) {
        matched++;

        // Try to match to an unpaid contribution
        const { data: unpaidContrib } = await supabase
          .from("contributions")
          .select("id, amount")
          .eq("member_id", matchedMember.id)
          .eq("status", "pending")
          .order("due_date", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (unpaidContrib) {
          await supabase.from("contributions").update({
            status: "paid",
            paid_date: new Date().toISOString().split("T")[0],
            payment_id: payment.id,
          }).eq("id", unpaidContrib.id);

          // Update member total contributions
          const { data: memberData } = await supabase
            .from("members")
            .select("total_contributions")
            .eq("id", matchedMember.id)
            .single();

          if (memberData) {
            await supabase.from("members").update({
              total_contributions: (memberData.total_contributions || 0) + amount,
            }).eq("id", matchedMember.id);
          }
        }

        results.push({
          ref: txn.TransactionReference,
          amount,
          matched: true,
          member: matchedMember.name,
          contribution_updated: !!unpaidContrib,
        });
      } else {
        unmatched++;

        // Add to unmatched queue
        await supabase.from("unmatched_payments").insert({
          payment_id: payment.id,
          raw_message: narration,
          extracted_amount: amount,
          extracted_phone: phone,
        });

        results.push({
          ref: txn.TransactionReference,
          amount,
          matched: false,
          narration,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total_credits: credits.length,
          processed,
          matched,
          unmatched,
          skipped_duplicates: skipped,
          account: txnResponse.AccountName,
        },
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
