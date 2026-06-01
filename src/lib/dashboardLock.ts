// Dashboard lock helpers: PIN (hashed) + optional biometric (WebAuthn) gate.
// This is a secondary convenience gate on top of normal authentication.
import { supabase } from "@/integrations/supabase/client";

const SESSION_PREFIX = "dash_unlocked_";

/** Hash a PIN with the user id as salt using SHA-256. */
export async function hashPin(pin: string, userId: string): Promise<string> {
  const data = new TextEncoder().encode(`${userId}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface DashboardSecurity {
  pin_hash: string | null;
  webauthn_credential_id: string | null;
}

export async function getSecurity(userId: string): Promise<DashboardSecurity | null> {
  const { data } = await (supabase as any)
    .from("dashboard_security")
    .select("pin_hash, webauthn_credential_id")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as DashboardSecurity) ?? null;
}

export async function savePin(userId: string, pin: string): Promise<void> {
  const pin_hash = await hashPin(pin, userId);
  const { error } = await (supabase as any)
    .from("dashboard_security")
    .upsert({ user_id: userId, pin_hash }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function verifyPin(userId: string, pin: string): Promise<boolean> {
  const sec = await getSecurity(userId);
  if (!sec?.pin_hash) return false;
  const candidate = await hashPin(pin, userId);
  return candidate === sec.pin_hash;
}

// ---- Session unlock state (per area, per browser session) ----
export function isUnlocked(area: string): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(SESSION_PREFIX + area) === "1";
}

export function setUnlocked(area: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SESSION_PREFIX + area, "1");
}

export function lockAll(): void {
  if (typeof window === "undefined") return;
  Object.keys(window.sessionStorage)
    .filter((k) => k.startsWith(SESSION_PREFIX))
    .forEach((k) => window.sessionStorage.removeItem(k));
}

// ---- Biometric (WebAuthn platform authenticator) ----
export function biometricSupported(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

function bufToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = "";
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBuf(b64: string): ArrayBuffer {
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  const norm = b64.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const str = atob(norm);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes.buffer;
}

/** Register a platform (fingerprint/face) authenticator and store its credential id. */
export async function registerBiometric(userId: string, displayName: string): Promise<void> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Welfare App", id: window.location.hostname },
      user: {
        id: new TextEncoder().encode(userId),
        name: displayName || "user",
        displayName: displayName || "user",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
      },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;

  if (!cred) throw new Error("Biometric registration cancelled");
  const credentialId = bufToBase64Url(cred.rawId);
  const { error } = await (supabase as any)
    .from("dashboard_security")
    .upsert({ user_id: userId, webauthn_credential_id: credentialId }, { onConflict: "user_id" });
  if (error) throw error;
}

/** Prompt the platform authenticator; resolves true if the user passes biometric. */
export async function verifyBiometric(userId: string): Promise<boolean> {
  const sec = await getSecurity(userId);
  if (!sec?.webauthn_credential_id) return false;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [
        {
          type: "public-key",
          id: base64UrlToBuf(sec.webauthn_credential_id),
        },
      ],
      userVerification: "required",
      timeout: 60000,
    },
  });
  return !!assertion;
}
