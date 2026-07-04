// Client-side Firebase Cloud Messaging setup.
//
// Fetches the public Firebase config from the `firebase-config` edge function,
// asks the user for notification permission, obtains a device token and stores
// it in `push_tokens`. Fails silently (and logs) when Firebase isn't configured
// yet, so the app keeps working without push.

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from "firebase/messaging";
import { supabase } from "@/integrations/supabase/client";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const CONFIG_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/firebase-config`;

let cachedConfig: any = null;
let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;
let initialized = false;

async function loadConfig() {
  if (cachedConfig) return cachedConfig;
  try {
    const res = await fetch(CONFIG_URL);
    const json = await res.json();
    if (json?.configured) {
      cachedConfig = json.config;
      return cachedConfig;
    }
  } catch (e) {
    console.warn("[push] could not load firebase config", e);
  }
  return null;
}

/**
 * Initialise push notifications for the signed-in user. Safe to call multiple
 * times; only performs setup once and only when Firebase is configured.
 */
export async function initPushNotifications() {
  if (initialized) return;
  try {
    if (!(await isSupported())) return;
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;

    const config = await loadConfig();
    if (!config) return;

    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return;

    // Ask permission (this triggers the browser prompt).
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    // Register the FCM service worker with the config in the query string.
    const swParams = new URLSearchParams({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    }).toString();
    const registration = await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?${swParams}`,
    );

    app = getApps().length ? getApps()[0] : initializeApp(config);
    messaging = getMessaging(app);

    const token = await getToken(messaging, {
      vapidKey: config.vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      await supabase
        .from("push_tokens")
        .upsert(
          {
            user_id: user.id,
            token,
            platform: /android/i.test(navigator.userAgent)
              ? "android"
              : /iphone|ipad|ipod/i.test(navigator.userAgent)
              ? "ios"
              : "web",
            user_agent: navigator.userAgent,
          },
          { onConflict: "token" },
        );
    }

    // Foreground messages: show a notification with sound while app is open.
    onMessage(messaging, (payload) => {
      const title = payload.notification?.title || (payload.data as any)?.title || "New message";
      const bodyText = payload.notification?.body || (payload.data as any)?.body || "";
      try {
        new Audio("/notification.mp3").play().catch(() => {});
      } catch {
        /* ignore */
      }
      if (Notification.permission === "granted") {
        registration.showNotification(title, {
          body: bodyText,
          icon: "/favicon.png",
          badge: "/favicon.png",
          tag: (payload.data as any)?.tag || "welfare-msg",
        });
      }
    });

    initialized = true;
  } catch (e) {
    console.warn("[push] init failed", e);
  }
}

/** Fire a push to a set of users / a conversation via the edge function. */
export async function sendPush(opts: {
  userIds?: string[];
  conversationId?: string;
  toAll?: boolean;
  excludeUserId?: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  try {
    await supabase.functions.invoke("send-push", { body: opts });
  } catch (e) {
    console.warn("[push] send failed", e);
  }
}
