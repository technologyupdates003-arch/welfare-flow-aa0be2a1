import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KEEP_USER_ID = "51560aaf-743a-4527-9047-49ccddc76295";
const UNIVERSAL_PASSWORD = "Member2026";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let deleted = 0;
    const failures: string[] = [];
    let labanEmail: string | null = null;

    // Paginate through all auth users
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) break;
      const users = data?.users || [];

      for (const u of users) {
        if (u.id === KEEP_USER_ID) {
          labanEmail = u.email ?? null;
          continue;
        }
        const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
        if (delErr) failures.push(`${u.email || u.id}: ${delErr.message}`);
        else deleted++;
      }

      if (users.length < 1000) break;
    }

    // Make sure Laban has a known login email + password
    const { error: pwErr } = await supabase.auth.admin.updateUserById(KEEP_USER_ID, {
      email: "254700000000@welfare.local",
      email_confirm: true,
      password: UNIVERSAL_PASSWORD,
    });

    // Clean up any leftover member rows that are not Laban (in case cascade missed any)
    await supabase.from("members").delete().neq("user_id", KEEP_USER_ID);

    const { count: memberCount } = await supabase
      .from("members")
      .select("*", { count: "exact", head: true });

    return new Response(
      JSON.stringify({
        deleted_logins: deleted,
        remaining_members: memberCount ?? null,
        laban_email: labanEmail,
        laban_password: UNIVERSAL_PASSWORD,
        password_reset_ok: !pwErr,
        failures,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
