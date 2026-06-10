// filepath: supabase/functions/admin-registration/index.ts
// Admin endpoints for managing member registrations
// Endpoints:
// GET /admin/registrations - List all registrations
// GET /admin/registrations/:id - Get registration details
// POST /admin/registrations/:id/approve - Approve and send SMS
// POST /admin/registrations/:id/reject - Reject registration
// GET /admin/registration-config - Get config
// PUT /admin/registration-config - Update config

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ApprovalPayload {
  notes?: string;
}

interface RejectionPayload {
  reason: string;
}

interface ConfigUpdatePayload {
  retiring_date?: string;
  registration_fee?: number;
  active?: boolean;
  show_on_login?: boolean;
  auto_approve?: boolean;
}

// Verify admin access (roles are stored in user_roles)
async function verifyAdminAccess(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error || !data) return false;
  return data.some((r: any) => r.role === "admin" || r.role === "super_admin");
}

// Generate temporary password
function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Generate access token (JWT-like)
function generateAccessToken(registrationId: string): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 15);
  return `${registrationId}-${timestamp}-${randomStr}`;
}

// GET /registrations
async function listRegistrations(
  supabase: any,
  status?: string,
  page: number = 1
): Promise<Response> {
  let query = supabase
    .from("member_registrations")
    .select("id, full_name, phone_number, department, working_location, status, payment_status, created_at, verified_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const pageSize = 20;
  const offset = (page - 1) * pageSize;
  query = query.range(offset, offset + pageSize - 1);

  const { data, count, error } = await query;

  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      data,
      pagination: {
        page,
        pageSize,
        total: count,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// GET /registrations/:id
async function getRegistrationDetails(supabase: any, id: string): Promise<Response> {
  const { data: registration, error } = await supabase
    .from("member_registrations")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !registration) {
    return new Response(JSON.stringify({ success: false, error: "Registration not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get payment details
  const { data: fees } = await supabase
    .from("registration_fees")
    .select("*")
    .eq("registration_id", id);

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        ...registration,
        fees,
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// POST /registrations/:id/approve
async function approveRegistration(
  supabase: any,
  id: string,
  payload: ApprovalPayload,
  adminId: string
): Promise<Response> {
  // Get registration
  const { data: registration, error: regError } = await supabase
    .from("member_registrations")
    .select("id, full_name, phone_number, status")
    .eq("id", id)
    .single();

  if (regError || !registration) {
    return new Response(JSON.stringify({ success: false, error: "Registration not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (registration.status === "active") {
    return new Response(
      JSON.stringify({ success: false, error: "Registration already approved and active" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Generate credentials
  const tempPassword = generateTemporaryPassword();
  const accessToken = generateAccessToken(id);
  const systemLink = `${Deno.env.get("SYSTEM_URL") || "https://system.example.com"}/register/${accessToken}`;

  // Create access link record
  const { error: linkError } = await supabase.from("registration_access_links").insert({
    registration_id: id,
    access_token: accessToken,
    temporary_password: tempPassword,
  });

  if (linkError) {
    console.error("Access link creation error:", linkError);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to create access link" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Update registration status
  const { error: updateError } = await supabase
    .from("member_registrations")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: adminId,
      approval_notes: payload.notes || null,
    })
    .eq("id", id);

  if (updateError) {
    return new Response(
      JSON.stringify({ success: false, error: "Failed to update registration" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Send SMS with system access
  try {
    const message = `Karibu kwenye jamii yetu! Ingia kwenye mfumo:\n${systemLink}\n\nNeno la siri: ${tempPassword}\n\nBadilisha neno lako baada ya kuingia kwenye mfumo.`;

    await supabase.functions.invoke("send-sms", {
      body: {
        phone: registration.phone_number,
        message: message,
      },
    });
  } catch (smsErr) {
    console.error("SMS send error:", smsErr);
    // Don't fail the approval if SMS fails
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Registration approved and SMS sent",
      data: {
        registration_id: id,
        system_link: systemLink,
        temporary_password: tempPassword,
      },
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// POST /registrations/:id/reject
async function rejectRegistration(
  supabase: any,
  id: string,
  payload: RejectionPayload,
  adminId: string
): Promise<Response> {
  if (!payload.reason || payload.reason.trim().length === 0) {
    return new Response(
      JSON.stringify({ success: false, error: "Rejection reason required" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Update registration status
  const { error } = await supabase
    .from("member_registrations")
    .update({
      status: "rejected",
      rejection_reason: payload.reason,
    })
    .eq("id", id);

  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get registration for SMS
  const { data: registration } = await supabase
    .from("member_registrations")
    .select("phone_number, full_name")
    .eq("id", id)
    .single();

  // Send rejection SMS
  if (registration) {
    try {
      const message = `Asante kwa kamatia! Ombi lako halijalipulikana: ${payload.reason}. Jaribu tena baadaye.`;
      await supabase.functions.invoke("send-sms", {
        body: {
          phone: registration.phone_number,
          message: message,
        },
      });
    } catch (smsErr) {
      console.error("SMS send error:", smsErr);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Registration rejected and SMS sent to member",
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// GET /registration-config
async function getConfig(supabase: any): Promise<Response> {
  const { data, error } = await supabase
    .from("registration_config")
    .select("*")
    .eq("active", true)
    .single();

  if (error) {
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          retiring_date: "2027-12-31",
          registration_fee: 1000,
          active: true,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// PUT /registration-config
async function updateConfig(
  supabase: any,
  payload: ConfigUpdatePayload,
  adminId: string
): Promise<Response> {
  if (!payload.retiring_date && !payload.registration_fee) {
    return new Response(
      JSON.stringify({ success: false, error: "At least one field required" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { error } = await supabase
    .from("registration_config")
    .update({
      ...(payload.retiring_date && { retiring_date: payload.retiring_date }),
      ...(payload.registration_fee && { registration_fee: payload.registration_fee }),
      ...(payload.active !== undefined && { active: payload.active }),
      updated_at: new Date().toISOString(),
      updated_by: adminId,
    })
    .eq("active", true);

  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Configuration updated successfully",
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/functions\/v1\/admin-registration/, "");
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Get auth header to verify admin
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify admin access (simplified - in production use proper JWT verification)
  const token = authHeader.replace("Bearer ", "");
  const { data: userData } = await supabase.auth.getUser(token);

  if (!userData?.user) {
    return new Response(JSON.stringify({ success: false, error: "Invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const isAdmin = await verifyAdminAccess(supabase, userData.user.id);
  if (!isAdmin) {
    return new Response(JSON.stringify({ success: false, error: "Admin access required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (path === "" || path === "/" || path === "/registrations") {
      if (req.method === "GET") {
        const status = url.searchParams.get("status");
        const page = parseInt(url.searchParams.get("page") || "1");
        return listRegistrations(supabase, status || undefined, page);
      }
    }

    const detailMatch = path.match(/^\/registrations\/([a-f0-9-]+)$/);
    if (detailMatch && req.method === "GET") {
      return getRegistrationDetails(supabase, detailMatch[1]);
    }

    const approveMatch = path.match(/^\/registrations\/([a-f0-9-]+)\/approve$/);
    if (approveMatch && req.method === "POST") {
      const payload = await req.json();
      return approveRegistration(supabase, approveMatch[1], payload, userData.user.id);
    }

    const rejectMatch = path.match(/^\/registrations\/([a-f0-9-]+)\/reject$/);
    if (rejectMatch && req.method === "POST") {
      const payload = await req.json();
      return rejectRegistration(supabase, rejectMatch[1], payload, userData.user.id);
    }

    if (path === "/config" || path === "/registration-config") {
      if (req.method === "GET") {
        return getConfig(supabase);
      } else if (req.method === "PUT") {
        const payload = await req.json();
        return updateConfig(supabase, payload, userData.user.id);
      }
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
