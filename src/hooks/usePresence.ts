import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

// Heartbeat interval. Kept comfortably under the 2-minute "online" window used
// by useOnlineMembers, but low-frequency enough that 2M clients don't hammer
// the database (one small upsert per user per minute, only while visible).
const HEARTBEAT_MS = 60000;

export function usePresence() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const upsertPresence = async (online: boolean) => {
      await supabase.from("user_presence").upsert(
        { user_id: user.id, is_online: online, last_seen: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    };

    upsertPresence(true);

    const interval = setInterval(() => {
      // Skip heartbeats for backgrounded tabs — they go stale and drop out of
      // the online window naturally.
      if (document.visibilityState === "visible") upsertPresence(true);
    }, HEARTBEAT_MS);

    const handleVisibility = () => {
      upsertPresence(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const handleBeforeUnload = () => upsertPresence(false);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      upsertPresence(false);
    };
  }, [user]);
}
