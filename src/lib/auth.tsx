import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type UserRole = "admin" | "member" | "chairperson" | "vice_chairperson" | "secretary" | "vice_secretary" | "patron" | "super_admin" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole;
  roles: UserRole[];
  loading: boolean;
  memberId: string | null;
  signIn: (phone: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberId, setMemberId] = useState<string | null>(null);
  const initialized = useRef(false);
  const roleSubscription = useRef<any>(null);

  const fetchRoles = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const userRoles = (data?.map(r => r.role as UserRole) || []) as UserRole[];
    // Return primary role (super_admin > admin > other roles)
    const primaryRole = userRoles.includes("super_admin") ? "super_admin" :
                       userRoles.includes("admin") ? "admin" :
                       userRoles[0] || "member";
    return { primaryRole, allRoles: userRoles };
  };

  const fetchMemberId = async (userId: string) => {
    const { data } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    return data?.id || null;
  };

  const subscribeToRoleChanges = (userId: string) => {
    // Unsubscribe from previous subscription if it exists
    if (roleSubscription.current) {
      roleSubscription.current.unsubscribe();
    }

    // Subscribe to real-time changes on user_roles table
    roleSubscription.current = supabase
      .channel(`user_roles:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_roles",
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          // When roles change, refetch them
          const { primaryRole, allRoles } = await fetchRoles(userId);
          setRole(primaryRole);
          setRoles(allRoles);
        }
      )
      .subscribe();
  };

  const handleSession = async (newSession: Session | null) => {
    setSession(newSession);
    setUser(newSession?.user ?? null);
    
    if (newSession?.user) {
      const [{ primaryRole, allRoles }, userMemberId] = await Promise.all([
        fetchRoles(newSession.user.id),
        fetchMemberId(newSession.user.id),
      ]);
      setRole(primaryRole);
      setRoles(allRoles);
      setMemberId(userMemberId);
      
      // Subscribe to real-time role changes
      subscribeToRoleChanges(newSession.user.id);
    } else {
      setRole(null);
      setRoles([]);
      setMemberId(null);
      
      // Unsubscribe from role changes
      if (roleSubscription.current) {
        roleSubscription.current.unsubscribe();
        roleSubscription.current = null;
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    // Get initial session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!initialized.current) {
        initialized.current = true;
        handleSession(session);
      }
    });

    // Then listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (initialized.current) {
          handleSession(session);
        } else {
          initialized.current = true;
          handleSession(session);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      if (roleSubscription.current) {
        roleSubscription.current.unsubscribe();
      }
    };
  }, []);

  const signIn = async (phone: string, password: string) => {
    const email = `${phone.replace("+", "")}@welfare.local`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    try {
      // Re-lock all dashboards so the next user must verify their PIN/biometric
      const { lockAll } = await import("@/lib/dashboardLock");
      lockAll();
    } catch (_) { /* ignore */ }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, role, roles, loading, memberId, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
