import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

interface ResetPasswordRequest {
  user_id: string;
  new_password: string;
  reset_reason: string;
}

export async function handler(
  req: Request,
): Promise<Response> {
  // Verify it's a POST request
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const body: ResetPasswordRequest = await req.json();
    const { user_id, new_password, reset_reason } = body;

    if (!user_id || !new_password) {
      return new Response(
        JSON.stringify({ error: "user_id and new_password are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log(`[admin-reset-password] Resetting password for user: ${user_id}`);

    // Update the user's password using admin API
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { password: new_password }
    );

    if (error) {
      console.error(`[admin-reset-password] Error updating password:`, error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message || "Failed to reset password",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[admin-reset-password] Password reset successfully for user: ${user_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Password reset successfully",
        user_id: data.user?.id,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[admin-reset-password] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
