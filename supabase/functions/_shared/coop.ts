// Shared Co-operative Bank (Open Banking / Developer Portal) client.
//
// All collections (STK push) and all payouts (funds transfer / B2C) in this
// system go through Co-op Bank. Safaricom Daraja is no longer used.
//
// Required secrets:
//   COOP_CONSUMER_KEY          - Consumer Key from the Co-op developer portal app
//   COOP_CONSUMER_SECRET       - Consumer Secret
//   COOP_MAIN_ACCOUNT          - Bank account for MONTHLY CONTRIBUTIONS
//   COOP_COLLECTION_ACCOUNT    - Bank account for PENALTIES / FUND DRIVES / OPERATIONAL
//   COOP_PAYOUT_ACCOUNT        - (optional) account debited for payouts; defaults per wallet
//
// Optional overrides (only if the bank gives you different paths / a sandbox):
//   COOP_BASE_URL, COOP_TOKEN_URL, COOP_STK_URL, COOP_STK_STATUS_URL,
//   COOP_FT_URL, COOP_BALANCE_URL, COOP_CALLBACK_BASE

export const COOP_BASE =
  Deno.env.get("COOP_BASE_URL") ?? "https://developer.co-opbank.co.ke:8243";

export const COOP_TOKEN_URL =
  Deno.env.get("COOP_TOKEN_URL") ?? `${COOP_BASE}/token`;

/** Co-op Bank "Mpesa STK Push" (collection) endpoint. */
export const COOP_STK_URL =
  Deno.env.get("COOP_STK_URL") ?? `${COOP_BASE}/Mpesa/STKPush/1.0.0/StkPush`;

/** Co-op Bank STK status / query endpoint. */
export const COOP_STK_STATUS_URL =
  Deno.env.get("COOP_STK_STATUS_URL") ??
  `${COOP_BASE}/Mpesa/STKPush/1.0.0/StkPushQuery`;

/** Co-op Bank Funds Transfer (Account -> M-Pesa / bank) endpoint. */
export const COOP_FT_URL =
  Deno.env.get("COOP_FT_URL") ??
  `${COOP_BASE}/FundsTransfer/DisburseFunds/1.0.0/DisburseFunds`;

/** Co-op Bank account balance enquiry endpoint. */
export const COOP_BALANCE_URL =
  Deno.env.get("COOP_BALANCE_URL") ??
  `${COOP_BASE}/Enquiry/AccountBalance/1.0.0/Account`;

export type WalletKind = "contribution" | "penalty" | "donation" | "operational";

/**
 * Which bank account collects money for a given purpose.
 * - contribution -> MAIN account (monthly contributions)
 * - penalty / donation (fund drive) / operational -> COLLECTION account
 */
export function collectionAccount(kind: WalletKind): string {
  const main = Deno.env.get("COOP_MAIN_ACCOUNT") ?? "";
  const collection = Deno.env.get("COOP_COLLECTION_ACCOUNT") ?? main;
  return kind === "contribution" ? main : collection;
}

/** Which bank account is debited when paying money out. */
export function payoutAccount(kind: WalletKind): string {
  return Deno.env.get("COOP_PAYOUT_ACCOUNT") ?? collectionAccount(kind);
}

export function callbackUrl(path: string): string {
  const base =
    Deno.env.get("COOP_CALLBACK_BASE") ??
    `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export function normalizePhone(p: string): string {
  const digits = (p || "").replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return "254" + digits.slice(1);
  if (digits.startsWith("7") || digits.startsWith("1")) return "254" + digits;
  return digits;
}

export function messageReference(prefix = "KHCWW"): string {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 30);
}

export function coopConfigured(): boolean {
  return Boolean(
    Deno.env.get("COOP_CONSUMER_KEY") && Deno.env.get("COOP_CONSUMER_SECRET"),
  );
}

/** OAuth2 client-credentials token from the Co-op developer portal. */
export async function getCoopToken(): Promise<string> {
  const key = Deno.env.get("COOP_CONSUMER_KEY");
  const secret = Deno.env.get("COOP_CONSUMER_SECRET");
  if (!key || !secret) {
    throw new Error(
      "Co-op Bank not configured. Add COOP_CONSUMER_KEY and COOP_CONSUMER_SECRET.",
    );
  }
  const res = await fetch(COOP_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${key}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    throw new Error(`Co-op token request failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error("Co-op token response had no access_token");
  return data.access_token as string;
}

export async function coopPost(
  url: string,
  payload: unknown,
): Promise<{ ok: boolean; status: number; data: any }> {
  const token = await getCoopToken();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * Co-op APIs signal success with MessageCode / ResponseCode "0" (some
 * endpoints return "000" or numeric 0). Treat all of those as success.
 */
export function coopSuccess(data: any): boolean {
  const code = String(
    data?.MessageCode ?? data?.ResponseCode ?? data?.StatusCode ?? "",
  ).trim();
  return code === "0" || code === "00" || code === "000";
}

export function coopMessage(data: any): string {
  return (
    data?.MessageDescription ??
    data?.ResponseDescription ??
    data?.StatusDescription ??
    data?.message ??
    "Unknown response from Co-op Bank"
  );
}
