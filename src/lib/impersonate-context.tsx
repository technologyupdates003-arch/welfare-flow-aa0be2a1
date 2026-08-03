import React, { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface ImpersonateContextType {
  impersonatedMemberId: string | null;
  impersonatedUserId: string | null;
  isImpersonating: boolean;
}

const ImpersonateContext = createContext<ImpersonateContextType>({
  impersonatedMemberId: null,
  impersonatedUserId: null,
  isImpersonating: false,
});

export function ImpersonateProvider({
  children,
  impersonatedMemberId = null,
}: {
  children: ReactNode;
  impersonatedMemberId?: string | null;
}) {
  // Resolve the impersonated member's auth user id so member pages that key
  // off user_id (documents, profile, notifications, payments) show that
  // member's data instead of the admin's.
  const { data: impersonatedUserId = null } = useQuery({
    queryKey: ["impersonated-user-id", impersonatedMemberId],
    queryFn: async () => {
      if (!impersonatedMemberId) return null;
      const { data } = await supabase
        .from("members")
        .select("user_id")
        .eq("id", impersonatedMemberId)
        .maybeSingle();
      return data?.user_id ?? null;
    },
    enabled: !!impersonatedMemberId,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <ImpersonateContext.Provider
      value={{
        impersonatedMemberId,
        impersonatedUserId,
        isImpersonating: !!impersonatedMemberId,
      }}
    >
      {children}
    </ImpersonateContext.Provider>
  );
}

export function useImpersonate() {
  return useContext(ImpersonateContext);
}

/**
 * Returns the identity that member pages should read/write with.
 * When an admin is viewing a member ("view as member"), this resolves to the
 * impersonated member; otherwise it is the signed-in user.
 */
export function useEffectiveIdentity() {
  const { user, memberId } = useAuth() as any;
  const { impersonatedMemberId, impersonatedUserId, isImpersonating } = useImpersonate();

  return {
    isImpersonating,
    // read-only while impersonating: no writes on behalf of the member
    readOnly: isImpersonating,
    memberId: isImpersonating ? impersonatedMemberId : memberId ?? null,
    userId: isImpersonating ? impersonatedUserId : user?.id ?? null,
    ready: isImpersonating ? !!impersonatedUserId || !!impersonatedMemberId : !!user,
  };
}
