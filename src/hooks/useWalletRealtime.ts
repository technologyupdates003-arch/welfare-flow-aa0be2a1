import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type WalletType = "penalty" | "donation" | "operational";

interface RealtimeCallbacks {
  onWalletUpdate?: (data: any) => void;
  onTransactionInsert?: (data: any) => void;
  onWithdrawalUpdate?: (data: any) => void;
  onSignatoryUpdate?: (data: any) => void;
  onB2CUpdate?: (data: any) => void;
}

export function useWalletRealtime(
  walletType: WalletType,
  callbacks: RealtimeCallbacks = {}
) {
  const {
    onWalletUpdate,
    onTransactionInsert,
    onWithdrawalUpdate,
    onSignatoryUpdate,
    onB2CUpdate,
  } = callbacks;

  // Subscribe to wallet updates
  useEffect(() => {
    const walletTable =
      walletType === "penalty"
        ? "penalty_wallet"
        : walletType === "donation"
          ? "donation_wallet"
          : "operational_wallet";

    const subscription = supabase
      .channel(`${walletType}_wallet`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: walletTable,
        },
        (payload) => {
          onWalletUpdate?.(payload.new);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [walletType, onWalletUpdate]);

  // Subscribe to wallet transactions
  useEffect(() => {
    const subscription = supabase
      .channel(`${walletType}_transactions`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "wallet_transactions",
          filter: `wallet_type=eq.${walletType}`,
        },
        (payload) => {
          onTransactionInsert?.(payload.new);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [walletType, onTransactionInsert]);

  // Subscribe to withdrawals
  useEffect(() => {
    const withdrawalTable =
      walletType === "penalty"
        ? "penalty_withdrawals"
        : walletType === "donation"
          ? "donation_withdrawals"
          : "operational_withdrawals";

    const subscription = supabase
      .channel(`${walletType}_withdrawals`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: withdrawalTable,
        },
        (payload) => {
          onWithdrawalUpdate?.(payload.new);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [walletType, onWithdrawalUpdate]);

  // Subscribe to withdrawal signatories
  useEffect(() => {
    const signatoryTable =
      walletType === "penalty"
        ? "withdrawal_signatories"
        : walletType === "donation"
          ? "donation_withdrawal_signatories"
          : "operational_withdrawal_signatories";

    const subscription = supabase
      .channel(`${walletType}_signatories`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: signatoryTable,
        },
        (payload) => {
          onSignatoryUpdate?.(payload.new);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [walletType, onSignatoryUpdate]);

  // Subscribe to B2C transactions
  useEffect(() => {
    const subscription = supabase
      .channel(`${walletType}_b2c`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "b2c_transactions",
          filter: `wallet_type=eq.${walletType}`,
        },
        (payload) => {
          onB2CUpdate?.(payload.new);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [walletType, onB2CUpdate]);
}

// Hook for subscribing to all wallet types
export function useAllWalletsRealtime(callbacks: RealtimeCallbacks = {}) {
  const {
    onWalletUpdate,
    onTransactionInsert,
    onWithdrawalUpdate,
    onSignatoryUpdate,
    onB2CUpdate,
  } = callbacks;

  // Subscribe to all wallet updates
  useEffect(() => {
    const subscription = supabase
      .channel("all_wallets")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "penalty_wallet",
        },
        (payload) => {
          onWalletUpdate?.({ ...payload.new, wallet_type: "penalty" });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "donation_wallet",
        },
        (payload) => {
          onWalletUpdate?.({ ...payload.new, wallet_type: "donation" });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "operational_wallet",
        },
        (payload) => {
          onWalletUpdate?.({ ...payload.new, wallet_type: "operational" });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [onWalletUpdate]);

  // Subscribe to all wallet transactions
  useEffect(() => {
    const subscription = supabase
      .channel("all_transactions")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "wallet_transactions",
        },
        (payload) => {
          onTransactionInsert?.(payload.new);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [onTransactionInsert]);

  // Subscribe to all withdrawals
  useEffect(() => {
    const subscription = supabase
      .channel("all_withdrawals")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "penalty_withdrawals",
        },
        (payload) => {
          onWithdrawalUpdate?.({ ...payload.new, wallet_type: "penalty" });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "donation_withdrawals",
        },
        (payload) => {
          onWithdrawalUpdate?.({ ...payload.new, wallet_type: "donation" });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "operational_withdrawals",
        },
        (payload) => {
          onWithdrawalUpdate?.({ ...payload.new, wallet_type: "operational" });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [onWithdrawalUpdate]);

  // Subscribe to all signatories
  useEffect(() => {
    const subscription = supabase
      .channel("all_signatories")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "withdrawal_signatories",
        },
        (payload) => {
          onSignatoryUpdate?.({ ...payload.new, wallet_type: "penalty" });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "donation_withdrawal_signatories",
        },
        (payload) => {
          onSignatoryUpdate?.({ ...payload.new, wallet_type: "donation" });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "operational_withdrawal_signatories",
        },
        (payload) => {
          onSignatoryUpdate?.({ ...payload.new, wallet_type: "operational" });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [onSignatoryUpdate]);

  // Subscribe to all B2C transactions
  useEffect(() => {
    const subscription = supabase
      .channel("all_b2c")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "b2c_transactions",
        },
        (payload) => {
          onB2CUpdate?.(payload.new);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [onB2CUpdate]);
}
