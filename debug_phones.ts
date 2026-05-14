import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const normalizePhone = (phone: string): string => {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("254")) return "+" + digits;
  if (digits.startsWith("0")) return "+254" + digits.substring(1);
  if (digits.length === 9) return "+254" + digits;
  return "+" + digits;
};

async function debug() {
  console.log("Fetching members...");
  const { data: members, error } = await supabase
    .from("members")
    .select("id, name, phone")
    .limit(20);

  if (error) {
    console.error("Error fetching members:", error);
    process.exit(1);
  }

  console.log("\n=== Members Phone Formats ===");
  members?.forEach((m) => {
    console.log(
      `${m.name}: "${m.phone}" -> normalized: "${normalizePhone(m.phone)}"`
    );
  });

  // Test with the phone numbers from the screenshot
  const testPhones = ["728854966", "0111679186"];
  console.log("\n=== Test Phone Matching ===");
  testPhones.forEach((phone) => {
    const normalized = normalizePhone(phone);
    const match = members?.find((m) => normalizePhone(m.phone) === normalized);
    console.log(
      `Phone ${phone} -> ${normalized}: ${match ? `✓ Matched: ${match.name}` : "✗ No match"}`
    );
  });
}

debug().catch(console.error);
