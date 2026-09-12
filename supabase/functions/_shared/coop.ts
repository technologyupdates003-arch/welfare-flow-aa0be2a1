// Shared Co-operative Bank Open API client (PRODUCTION).
//
// Live gateway: https://openapi.co-opbank.co.ke
// All collections (STK push) and all payouts (A2M / IFT / Pesalink) go
// through Co-op Bank. Safaricom Daraja is no longer used.
//
// Secrets:
//   COOP_CONSUMER_KEY          - Consumer Key of the Co-op Open API app
//   COOP_CONSUMER_SECRET       - Consumer Secret
//   COOP_USER_ID               - UserId issued by the bank (e.g. KirinyagaHealthCare)
//   COOP_OPERATOR_CODE         - OperatorCode for STK (e.g. KIRINYAGA)
//   COOP_MAIN_ACCOUNT          - Bank account for MONTHLY CONTRIBUTIONS
//   COOP_COLLECTION_ACCOUNT    - Bank account for PENALTIES / FUND DRIVES / OPERATIONAL
//   COOP_PAYOUT_ACCOUNT        - (optional) account debited for payouts
//   COOP_BASE_URL              - (optional) gateway override
//   COOP_CALLBACK_BASE         - (optional) public callback base URL

export const COOP_BASE = (
  Deno.env.get("COOP_BASE_URL") ?? "https://openapi.co-opbank.co.ke"
).replace(/\/$/, "");

export const COOP_TOKEN_URL = Deno.env.get("COOP_TOKEN_URL") ?? `${COOP_BASE}/token`;

/** STK Push (collection). */
export const COOP_STK_URL = Deno.env.get("COOP_STK_URL") ?? `${COOP_BASE}/FT/stk/1.0.0`;

/** STK transaction status. */
export const COOP_STK_STATUS_URL =
  Deno.env.get("COOP_STK_STATUS_URL") ?? `${COOP_BASE}/Enquiry/STK/1.0.0/`;

/** Account -> M-Pesa payout (B2C). */
export const COOP_B2C_URL =
  Deno.env.get("COOP_B2C_URL") ??
  `${COOP_BASE}/FundsTransfer/External/A2M/Mpesa_v2/2.0.0`;

/** Backwards-compatible alias used by older code. */
export const COOP_FT_URL = COOP_B2C_URL;

/** Internal Co-op account to Co-op account transfer. */
export const COOP_IFT_URL =
  Deno.env.get("COOP_IFT_URL") ??
  `${COOP_BASE}/FundsTransfer/Internal/A2A_v3/3.0.0`;

/** Pesalink (account in another bank). */
export const COOP_PESALINK_URL =
  Deno.env.get("COOP_PESALINK_URL") ??
  `${COOP_BASE}/FundsTransfer/External/PesaLinkBulk_v1/1.0.0/`;

/** Pesalink account-name validation. */
export const COOP_PESALINK_VALIDATE_URL =
  Deno.env.get("COOP_PESALINK_VALIDATE_URL") ??
  `${COOP_BASE}/Enquiry/Validation/IPSL/1.0.0/`;

/** Generic transaction status (transfers). */
export const COOP_TXN_STATUS_URL =
  Deno.env.get("COOP_TXN_STATUS_URL") ??
  `${COOP_BASE}/Enquiry/TransactionStatus_V3/3.0.0/`;

/** Account balance. */
export const COOP_BALANCE_URL =
  Deno.env.get("COOP_BALANCE_URL") ??
  `${COOP_BASE}/Enquiry/AccountBalance_v2/2.0.0/`;

/** Mini statement (last few transactions). */
export const COOP_MINISTATEMENT_URL =
  Deno.env.get("COOP_MINISTATEMENT_URL") ??
  `${COOP_BASE}/Enquiry/MiniStatement/Account_v2/2.0.0/`;

/** Full statement between two dates (paginated). */
export const COOP_STATEMENT_URL =
  Deno.env.get("COOP_STATEMENT_URL") ??
  `${COOP_BASE}/Enquiry/AccountFullStatementPaginated/1.0.0/`;

export type WalletKind = "contribution" | "penalty" | "donation" | "operational";

export function coopUserId(): string {
  return Deno.env.get("COOP_USER_ID") ?? "KirinyagaHealthCare";
}

export function coopOperatorCode(): string {
  return Deno.env.get("COOP_OPERATOR_CODE") ?? "KIRINYAGA";
}

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

/** Bank expects `2026-08-24T09:22:25.420Z` style timestamps. */
export function coopDateTime(d: Date = new Date()): string {
  return d.toISOString();
}

export function coopConfigured(): boolean {
  return Boolean(
    Deno.env.get("COOP_CONSUMER_KEY") && Deno.env.get("COOP_CONSUMER_SECRET"),
  );
}

let cachedToken: { value: string; expiresAt: number } | null = null;

/** OAuth2 client-credentials token (cached until shortly before expiry). */
export async function getCoopToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

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

  cachedToken = {
    value: data.access_token as string,
    expiresAt: Date.now() + (Number(data.expires_in ?? 3600) * 1000),
  };
  return cachedToken.value;
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
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { MessageDescription: text };
  }
  return { ok: res.ok, status: res.status, data };
}

/** Success codes returned by the Co-op gateway. */
export function coopSuccess(data: any): boolean {
  const code = String(
    data?.MessageCode ?? data?.ResponseCode ?? data?.StatusCode ?? "",
  ).trim();
  return code === "0" || code === "00" || code === "000";
}

/**
 * Still waiting on the customer / bank. 1037 = "No response from user"
 * (customer has not entered the M-Pesa PIN yet).
 */
export function coopPending(data: any): boolean {
  const code = String(data?.MessageCode ?? data?.ResponseCode ?? "").trim();
  return ["1037", "1032", "1", "1001", "9999"].includes(code);
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

/** Query the status of an STK push by its MessageReference. */
export async function coopStkStatus(messageRef: string) {
  return await coopPost(COOP_STK_STATUS_URL, {
    MessageReference: messageRef,
    UserId: coopUserId(),
  });
}

/** Query the status of a funds transfer by its MessageReference. */
export async function coopTransactionStatus(messageRef: string) {
  return await coopPost(COOP_TXN_STATUS_URL, {
    MessageReference: messageRef,
    UserId: coopUserId(),
  });
}

/** Account balance enquiry. */
export async function coopAccountBalance(accountNumber: string) {
  return await coopPost(COOP_BALANCE_URL, {
    MessageReference: messageReference("BAL"),
    UserId: coopUserId(),
    AccountNumber: accountNumber,
  });
}

/** Mini statement enquiry. */
export async function coopMiniStatement(accountNumber: string) {
  return await coopPost(COOP_MINISTATEMENT_URL, {
    MessageReference: messageReference("MST"),
    UserId: coopUserId(),
    AccountNumber: accountNumber,
  });
}

/** Full statement between two ISO dates (YYYY-MM-DD). */
export async function coopFullStatement(
  accountNumber: string,
  startDate: string,
  endDate: string,
) {
  return await coopPost(COOP_STATEMENT_URL, {
    MessageReference: messageReference("STM"),
    UserId: coopUserId(),
    ISO2CountryCode: "KE",
    AccountNumber: accountNumber,
    StartDate: startDate,
    EndDate: endDate,
  });
}
