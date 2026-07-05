import React, { createContext, useContext, ReactNode } from "react";

interface ImpersonateContextType {
  impersonatedMemberId: string | null;
  isImpersonating: boolean;
}

const ImpersonateContext = createContext<ImpersonateContextType>({
  impersonatedMemberId: null,
  isImpersonating: false,
});

export function ImpersonateProvider({ 
  children, 
  impersonatedMemberId = null 
}: { 
  children: ReactNode;
  impersonatedMemberId?: string | null;
}) {
  return (
    <ImpersonateContext.Provider value={{ 
      impersonatedMemberId, 
      isImpersonating: !!impersonatedMemberId 
    }}>
      {children}
    </ImpersonateContext.Provider>
  );
}

export function useImpersonate() {
  return useContext(ImpersonateContext);
}
