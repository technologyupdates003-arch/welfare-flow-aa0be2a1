import { useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
// Hard cap on how many live session cards we hydrate/render at once.
const LIST_LIMIT = 100;

function isFresh(lastSeen: string) {
  const t = new Date(lastSeen).getTime();
  return Date.now() - t <= ONLINE_WINDOW_MS;
}

function cutoffIso() {
  return new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();
}

interface PresenceSnapshot {
  list: OnlineUser[];
  onlineCount: number;
  onlineMemberCount: number;
}

/**
 * Realtime online-members tracker for Super Admin.
 *
 * Scalability notes: nothing is fetched "for all users". Totals come from
 * server-side COUNT queries (head-only, no rows transferred) and the visible
 * list is capped at LIST_LIMIT rows, so the page behaves the same with 30 or
 * 2,000,000 accounts. Realtime events are debounced into a single refetch.
 */
async function fetchPresence(): Promise<PresenceSnapshot> {
  const cutoff = cutoffIso();

  // Counts: head-only, computed in the database.
  const [{ count: onlineCount }, { data: presence }] = await Promise.all([
    supabase
      .from("user_presence")
      .select("user_id", { count: "exact", head: true })
      .eq("is_online", true)
      .gte("last_seen", cutoff),
    supabase
      .from("user_presence")
      .select("user_id, is_online, last_seen")
      .eq("is_online", true)
      .gte("last_seen", cutoff)
      .order("last_seen", { ascending: false })
      .limit(LIST_LIMIT),
  ]);

  if (!presence || presence.length === 0) {
    return { list: [], onlineCount: onlineCount || 0, onlineMemberCount: 0 };
  }

  const ids = presence.map((p) => p.user_id);

  // Only hydrate details for the capped page of rows we actually render.
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

  const list: OnlineUser[] = presence.map((p) => ({
    user_id: p.user_id,
    is_online: p.is_online,
    last_seen: p.last_seen,
    name: memberMap.get(p.user_id)?.name ?? null,
    phone: memberMap.get(p.user_id)?.phone ?? null,
    roles: roleMap.get(p.user_id) || [],
  }));

  // Members = users with no elevated role. Approximated from the visible page
  // when there are more online users than the cap.
  const memberRatioBase = list.length || 1;
  const membersInPage = list.filter(
    (u) => u.roles.length === 0 || u.roles.includes("member")
  ).length;
  const total = onlineCount || list.length;
  const onlineMemberCount =
    total <= list.length
      ? membersInPage
      : Math.round((membersInPage / memberRatioBase) * total);

  return { list, onlineCount: total, onlineMemberCount };
}

export function useOnlineMembers() {
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["online-presence"],
    queryFn: fetchPresence,
    // Shared across every consumer of this hook — one request, not N.
    staleTime: 15000,
    refetchInterval: 30000,
  });

  const reload = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["online-presence"] });
  }, [queryClient]);

  useEffect(() => {
    const channel = supabase
      .channel("presence-superadmin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_presence" },
        () => {
          // Debounce: a burst of presence pings triggers ONE refetch.
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(reload, 3000);
        }
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [reload]);

  const online = data?.list ?? [];

  return {
    loading: isLoading,
    all: online,
    online,
    onlineCount: data?.onlineCount ?? 0,
    onlineMembers: online.filter((u) => u.roles.length === 0 || u.roles.includes("member")),
    onlineMemberCount: data?.onlineMemberCount ?? 0,
    listLimit: LIST_LIMIT,
    reload,
    isFresh,
  };
}
