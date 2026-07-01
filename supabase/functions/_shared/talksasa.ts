// Shared Talksasa SMS helper for all edge functions
// Docs: https://bulksms.talksasa.com/api/v3/sms/send

const TALKSASA_SEND_URL = "https://bulksms.talksasa.com/api/v3/sms/send";

// Normalize phones to 2547XXXXXXXX (no +, no leading 0)
export function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  let p = String(raw).replace(/[^\d+]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("0")) p = "254" + p.slice(1);
  if (p.startsWith("7") || p.startsWith("1")) p = "254" + p;
  if (!p.startsWith("254") || p.length !== 12) return null;
  return p;
}

export interface TalksasaResult {
  ok: boolean;
  status: "sent" | "failed";
  provider: unknown;
  error: string | null;
  insufficientBalance: boolean;
}

// Send an SMS to one or more (already normalized) recipients via Talksasa.
export async function sendTalksasaSms(
  recipients: string[],
  message: string,
  opts?: { scheduleTime?: string },
): Promise<TalksasaResult> {
  const token = Deno.env.get("TALKSASA_API_TOKEN");
  const senderId = Deno.env.get("TALKSASA_SENDER_ID") || "TALKSASA";

  if (!token) {
    return {
      ok: false,
      status: "failed",
      provider: null,
      error: "TALKSASA_API_TOKEN not configured",
      insufficientBalance: false,
    };
  }

  const body: Record<string, string> = {
    recipient: recipients.join(","),
    sender_id: senderId,
    type: "plain",
    message,
  };
  if (opts?.scheduleTime) body.schedule_time = opts.scheduleTime;

  const resp = await fetch(TALKSASA_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await resp.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  // Talksasa returns { status: "success" | "error", message?, data? }
  const providerOk = resp.ok && data?.status !== "error";
  const providerError = !providerOk
    ? (data?.message || data?.error || `SMS provider error (HTTP ${resp.status})`)
    : null;
  const insufficientBalance =
    typeof providerError === "string" && /insufficient|balance|credit/i.test(providerError);

  return {
    ok: providerOk,
    status: providerOk ? "sent" : "failed",
    provider: data,
    error: providerError,
    insufficientBalance,
  };
}
