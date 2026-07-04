import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

// Sends Firebase Cloud Messaging push notifications (background pop-ups with
// sound on Android + installed iOS/desktop PWAs).
//
// Body: {
//   userIds?: string[],       // target these users
//   conversationId?: string,  // OR everyone in this chat conversation
//   toAll?: boolean,          // OR every member with a device token
//   excludeUserId?: string,   // don't notify the sender
//   title: string, body: string,
//   data?: Record<string,string>
// }

function b64url(input: ArrayBuffer | string): string {
  let bytes: Uint8Array
  if (typeof input === 'string') bytes = new TextEncoder().encode(input)
  else bytes = new Uint8Array(input)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`

  // Import the private key (PEM PKCS#8)
  const pem = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const jwt = `${unsigned}.${b64url(sig)}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const json = await res.json()
  if (!json.access_token) throw new Error('Failed to get FCM access token: ' + JSON.stringify(json))
  return json.access_token
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const saRaw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
    if (!saRaw) {
      return new Response(JSON.stringify({ ok: false, error: 'FIREBASE_SERVICE_ACCOUNT not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      })
    }
    const serviceAccount = JSON.parse(saRaw)

    const body = await req.json().catch(() => ({}))
    const { userIds, conversationId, toAll, excludeUserId, title, body: msgBody, data } = body || {}

    if (!title || !msgBody) {
      return new Response(JSON.stringify({ ok: false, error: 'title and body are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Resolve target user ids
    let targets: string[] = []
    if (Array.isArray(userIds) && userIds.length) {
      targets = userIds
    } else if (conversationId) {
      const { data: parts } = await admin
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
      targets = (parts || []).map((p: any) => p.user_id)
    } else if (toAll) {
      const { data: toks } = await admin.from('push_tokens').select('user_id')
      targets = Array.from(new Set((toks || []).map((t: any) => t.user_id)))
    }

    if (excludeUserId) targets = targets.filter((id) => id !== excludeUserId)
    if (!targets.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, note: 'no targets' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      })
    }

    const { data: tokenRows } = await admin
      .from('push_tokens')
      .select('token, user_id')
      .in('user_id', targets)

    const tokens = (tokenRows || []).map((r: any) => r.token)
    if (!tokens.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, note: 'no device tokens' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      })
    }

    const accessToken = await getAccessToken(serviceAccount)
    const projectId = serviceAccount.project_id
    const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`

    const stringData: Record<string, string> = {}
    if (data) for (const k of Object.keys(data)) stringData[k] = String(data[k])

    let sent = 0
    const invalidTokens: string[] = []
    await Promise.all(
      tokens.map(async (token: string) => {
        const message = {
          message: {
            token,
            notification: { title, body: msgBody },
            data: stringData,
            android: { priority: 'high', notification: { sound: 'default', default_sound: true } },
            apns: { payload: { aps: { sound: 'default' } } },
            webpush: {
              headers: { Urgency: 'high' },
              notification: { title, body: msgBody, icon: '/favicon.png', badge: '/favicon.png' },
            },
          },
        }
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(message),
        })
        if (res.ok) {
          sent++
        } else {
          const err = await res.text()
          if (res.status === 404 || err.includes('UNREGISTERED') || err.includes('INVALID_ARGUMENT')) {
            invalidTokens.push(token)
          }
        }
      }),
    )

    // Clean up dead tokens
    if (invalidTokens.length) {
      await admin.from('push_tokens').delete().in('token', invalidTokens)
    }

    return new Response(JSON.stringify({ ok: true, sent, cleaned: invalidTokens.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    })
  }
})
