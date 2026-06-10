// filepath: supabase/functions/member-registration/index.ts
// New Member Registration API Handler
// Endpoints:
// POST /register - Submit new member registration
// GET /config - Get registration requirements
// POST /initiate-payment - Start STK Push payment
// GET /status/:id - Check registration status

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DARAJA_BASE = Deno.env.get("MPESA_BASE_URL") ?? "https://sandbox.safaricom.co.ke";

interface RegistrationRequest {
  full_name: string;
  phone_number: string;
  department: string;
  working_location: string;
  date_of_birth?: string;
}

interface PaymentInitRequest {
  registration_id: string;
  phone_number: string;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return "254" + digits.slice(1);
  if (digits.startsWith("7") || digits.startsWith("1")) return "254" + digits;
  return digits;
}

function validatePhoneNumber(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^254[17]\d{8}$/.test(normalized);
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function getDarajaToken(): Promise<string | null> {
  const key = Deno.env.get("MPESA_CONSUMER_KEY");
  const secret = Deno.env.get("MPESA_CONSUMER_SECRET");
  if (!key || !secret) return null;

  const auth = btoa(`${key}:${secret}`);
  try {
    const res = await fetch(`${DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials`, {
      method: "GET",
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

// GET /register/config
async function getRegistrationConfig(supabase: any) {
  const { data, error } = await supabase
    .from("registration_config")
    .select("retiring_date, registration_fee, active, show_on_login, auto_approve")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return {
      retiring_date: "2027-12-31",
      registration_fee: 1000,
      active: true,
      show_on_login: true,
      auto_approve: false,
      message: "Join our welfare group",
    };
  }

  return {
    ...data,
    message: "Join our welfare group",
  };
}

// POST /register
async function registerMember(
  supabase: any,
  payload: RegistrationRequest
): Promise<Response> {
  // Validate inputs
  if (!payload.full_name || payload.full_name.trim().length < 3) {
    return new Response(
      JSON.stringify({ success: false, error: "Full name required (min 3 characters)" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!validatePhoneNumber(payload.phone_number)) {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid phone number format" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!payload.department || payload.department.trim().length < 2) {
    return new Response(
      JSON.stringify({ success: false, error: "Department required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!payload.working_location || payload.working_location.trim().length < 2) {
    return new Response(
      JSON.stringify({ success: false, error: "Working location required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check if phone already registered today
  const today = new Date().toISOString().split("T")[0];
  const { data: existing } = await supabase
    .from("member_registrations")
    .select("id")
    .eq("phone_number", normalizePhone(payload.phone_number))
    .gte("created_at", `${today}T00:00:00Z`)
    .single();

  if (existing) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Registration already submitted today. Please check your SMS.",
      }),
      { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Create registration
  const { data: registration, error: regError } = await supabase
    .from("member_registrations")
    .insert({
      full_name: payload.full_name.trim(),
      phone_number: normalizePhone(payload.phone_number),
      department: payload.department.trim(),
      working_location: payload.working_location.trim(),
      date_of_birth: payload.date_of_birth || null,
      status: "payment_pending",
      payment_status: "unpaid",
    })
    .select("id")
    .single();

  if (regError || !registration) {
    console.error("Registration error:", regError);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to create registration" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get current config for fee
  const config = await getRegistrationConfig(supabase);

  return new Response(
    JSON.stringify({
      success: true,
      registration_id: registration.id,
      status: "payment_pending",
      registration_fee: config.registration_fee,
      message: "Please complete M-Pesa payment",
      next_step: "initiate_payment",
    }),
    { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// POST /initiate-payment
async function initiatePayment(supabase: any, payload: PaymentInitRequest): Promise<Response> {
  if (!payload.registration_id || !payload.phone_number) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing required fields" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get registration
  const { data: registration, error: regError } = await supabase
    .from("member_registrations")
    .select("id, status, payment_status")
    .eq("id", payload.registration_id)
    .single();

  if (regError || !registration) {
    return new Response(
      JSON.stringify({ success: false, error: "Registration not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (registration.payment_status === "verified") {
    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment already verified",
        status: "payment_verified",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get registration fee amount
  const config = await getRegistrationConfig(supabase);
  const amount = config.registration_fee;

  // Get Daraja token
  const token = await getDarajaToken();
  if (!token) {
    return new Response(
      JSON.stringify({ success: false, error: "Payment service unavailable" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Prepare STK Push
  const phone = normalizePhone(payload.phone_number);
  const SHORTCODE = Deno.env.get("MPESA_SHORTCODE") ?? "174379";
  const PASSKEY = Deno.env.get("MPESA_PASSKEY") ?? "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";
  const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/member-registration-callback`;

  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14);
  const password = btoa(`${SHORTCODE}${PASSKEY}${timestamp}`);

  const stkPayload = {
    BusinessShortCode: SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.round(amount),
    PartyA: phone,
    PartyB: SHORTCODE,
    PhoneNumber: phone,
    CallBackURL: callbackUrl,
    AccountReference: `REG-${registration.id.slice(0, 8)}`,
    TransactionDesc: "Member Registration Fee",
  };

  try {
    const res = await fetch(`${DARAJA_BASE}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stkPayload),
    });

    const stkData = await res.json().catch(() => ({}));
    const success = res.ok && stkData?.ResponseCode === "0";

    if (!success) {
      console.error("STK Push error:", stkData);
      return new Response(
        JSON.stringify({
          success: false,
          error: stkData?.errorMessage || stkData?.ResponseDescription || "Failed to initiate payment",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record payment attempt
    const { error: feeError } = await supabase.from("registration_fees").insert({
      registration_id: payload.registration_id,
      amount,
      phone_number: phone,
      mpesa_checkout_request_id: stkData?.CheckoutRequestID,
      status: "pending",
    });

    if (feeError) console.error("Fee record error:", feeError);

    // Update registration status
    await supabase
      .from("member_registrations")
      .update({ payment_status: "pending" })
      .eq("id", payload.registration_id);

    return new Response(
      JSON.stringify({
        success: true,
        checkout_request_id: stkData?.CheckoutRequestID,
        message: `Payment prompt sent to ${phone}. Enter your M-Pesa PIN.`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Payment initiation error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Payment service error" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// GET /status/:id
async function getRegistrationStatus(supabase: any, registrationId: string): Promise<Response> {
  const { data: registration, error } = await supabase
    .from("member_registrations")
    .select("id, status, payment_status, created_at, verified_at")
    .eq("id", registrationId)
    .single();

  if (error || !registration) {
    return new Response(
      JSON.stringify({ success: false, error: "Registration not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      registration_id: registration.id,
      status: registration.status,
      payment_status: registration.payment_status,
      created_at: registration.created_at,
      verified_at: registration.verified_at,
      message:
        registration.payment_status === "verified"
          ? "Your registration is verified. Awaiting admin approval."
          : "Please complete M-Pesa payment.",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  // Strip any prefix up to and including the function name so routing works
  // regardless of whether the runtime path includes /functions/v1
  const path = url.pathname.replace(/^.*\/member-registration/, "");
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    if (path === "" || path === "/" || path === "/register") {
      if (req.method === "POST") {
        const payload = await req.json();
        return registerMember(supabase, payload);
      } else if (req.method === "GET") {
        const config = await getRegistrationConfig(supabase);
        return new Response(JSON.stringify({ success: true, data: config }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (path === "/config" && req.method === "GET") {
      const config = await getRegistrationConfig(supabase);
      return new Response(JSON.stringify({ success: true, data: config }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === "/initiate-payment" && req.method === "POST") {
      const payload = await req.json();
      return initiatePayment(supabase, payload);
    }

    const statusMatch = path.match(/\/status\/([a-f0-9-]+)$/);
    if (statusMatch && req.method === "GET") {
      return getRegistrationStatus(supabase, statusMatch[1]);
    }

    return new Response(JSON.stringify({ success: false, error: "Endpoint not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Request error:", err);
    return new Response(JSON.stringify({ success: false, error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
