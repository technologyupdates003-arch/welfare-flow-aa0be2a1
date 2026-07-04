import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Returns the PUBLIC Firebase web config so the client can initialise
// messaging without hard-coding project values in the bundle. These values
// are not secret (they ship in every Firebase web app), but keeping them in
// secrets lets the owner swap Firebase projects without a code change.
Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const config = {
    apiKey: Deno.env.get('FIREBASE_API_KEY') ?? '',
    authDomain: Deno.env.get('FIREBASE_AUTH_DOMAIN') ?? '',
    projectId: Deno.env.get('FIREBASE_PROJECT_ID') ?? '',
    messagingSenderId: Deno.env.get('FIREBASE_MESSAGING_SENDER_ID') ?? '',
    appId: Deno.env.get('FIREBASE_APP_ID') ?? '',
    vapidKey: Deno.env.get('FIREBASE_VAPID_KEY') ?? '',
  }

  const configured = !!(config.apiKey && config.projectId && config.messagingSenderId && config.appId && config.vapidKey)

  return new Response(JSON.stringify({ configured, config }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
})
