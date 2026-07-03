import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OnlineUser {
  user_id: string;
  is_online: boolean;
  last_seen: string;
  name: string | null;
  phone: string | null;
  roles: string[];
}

// A user counts as "live" if flagged online and seen within this window.
const ONLINE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

function isFresh(lastSeen: string) {
  const t = new Date(lastSeen).getTime();
  return Date.now() - t <= ONLINE_WINDOW_MS;
}

/**
 * Realtime online-members tracker for Super Admin.
 * Streams user_presence changes and joins member + role details.
 */
export function useOnlineMembers() {
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    // Pull presence rows (RLS lets any authenticated user read presence)
    const { data: presence } = await supabase
      .from("user_presence")
      .select("user_id, is_online, last_seen")
      .order("last_seen", { ascending: false });

    if (!presence || presence.length === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const ids = presence.map((p) => p.user_id);

    const [{ data: members }, { data: roleRows }] = await Promise.all([
      supabase.from("members").select("user_id, name, phone").in("user_id", ids),
      supabase.from("user_roles").select("user_id, role").in("user_id", ids),
    ]);

    const memberMap = new Map((members || []).map((m) => [m.user_id, m]));
    const roleMap = new Map<string, string[]>();
    (roleRows || []).forEach((r) => {
      const list = roleMap.get(r.user_id) || [];
      list.push(r.role as string);
      roleMap.set(r.user_id, list);
    });

    const merged: OnlineUser[] = presence.map((p) => ({
      user_id: p.user_id,
      is_online: p.is_online,
      last_seen: p.last_seen,
      name: memberMap.get(p.user_id)?.name ?? null,
      phone: memberMap.get(p.user_id)?.phone ?? null,
      roles: roleMap.get(p.user_id) || [],
    }));

    setUsers(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();

    const channel = supabase
      .channel("presence-superadmin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_presence" },
        () => load()
      )
      .subscribe();

    // Re-evaluate freshness periodically even without new events
    const interval = setInterval(() => load(), 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [load]);

  const online = users.filter((u) => u.is_online && isFresh(u.last_seen));
  const onlineMembers = online.filter((u) => u.roles.length === 0 || u.roles.includes("member"));

  return {
    loading,
    all: users,
    online,
    onlineCount: online.length,
    onlineMembers,
    onlineMemberCount: onlineMembers.length,
    reload: load,
    isFresh,
  };
}
