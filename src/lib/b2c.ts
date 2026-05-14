/**
 * M-Pesa B2C (Business to Customer) Service
 * Handles withdrawal transfers from penalty wallet to member phone numbers
 */

import { supabase } from '@/integrations/supabase/client';

interface B2CPayload {
  withdrawalId: string;
  amount: number;
  phoneNumber: string;
  reason: string;
  adminName: string;
  walletType?: 'penalty' | 'donation';
}

interface B2CResponse {
  success: boolean;
  transactionId?: string;
  error?: string;
  message?: string;
}

/**
 * Format phone number to M-Pesa format (254XXXXXXXXX)
 */
export const formatPhoneForB2C = (phone: string): string => {
  // Remove any non-digit characters
  let cleaned = phone.replace(/\D/g, '');

  // If starts with 0, replace with 254
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.substring(1);
  }

  // If doesn't start with 254, add it
  if (!cleaned.startsWith('254')) {
    cleaned = '254' + cleaned;
  }

  return cleaned;
};

/**
 * Validate phone number format
 */
export const validatePhoneNumber = (phone: string): boolean => {
  const formatted = formatPhoneForB2C(phone);
  // Should be 254 + 9 digits = 12 digits total
  return /^254\d{9}$/.test(formatted);
};

/**
 * Initiate B2C withdrawal transfer
 * This function calls the backend API to process M-Pesa B2C transfer
 */
export const initiateB2CWithdrawal = async (payload: B2CPayload): Promise<B2CResponse> => {
  try {
    const formattedPhone = formatPhoneForB2C(payload.phoneNumber);

    if (!validatePhoneNumber(payload.phoneNumber)) {
      return {
        success: false,
        error: 'Invalid phone number format. Use format: 0712345678 or +254712345678',
      };
    }

    if (payload.amount <= 0) {
      return {
        success: false,
        error: 'Amount must be greater than 0',
      };
    }

    // Call edge function to process the real Co-op Bank B2C transfer
    const { data, error } = await supabase.functions.invoke('b2c-transfer', {
      body: {
        withdrawalId: payload.withdrawalId,
        amount: payload.amount,
        phoneNumber: formattedPhone,
        reason: payload.reason,
        adminName: payload.adminName,
        walletType: (payload as any).walletType ?? 'penalty',
      },
    });

    if (error || !data?.success) {
      return {
        success: false,
        error: data?.error || data?.message || error?.message || 'Failed to process B2C withdrawal',
      };
    }

    return {
      success: true,
      transactionId: data.transactionId,
      message: data.message ||
        `Withdrawal of KES ${payload.amount.toLocaleString()} initiated to ${formattedPhone}`,
    };
  } catch (error) {
    console.error('B2C withdrawal error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

/**
 * Check B2C transaction status
 */
export const checkB2CStatus = async (transactionId: string): Promise<B2CResponse> => {
  try {
    const response = await fetch(`/api/b2c/status/${transactionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: 'Failed to check transaction status',
      };
    }

    const data = await response.json();

    return {
      success: data.status === 'completed',
      transactionId: data.transactionId,
      message: data.message,
    };
  } catch (error) {
    console.error('B2C status check error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

/**
 * Poll B2C transaction status until completion
 */
export const pollB2CStatus = async (
  transactionId: string,
  maxAttempts: number = 30,
  intervalMs: number = 10000
): Promise<B2CResponse> => {
  let attempts = 0;

  return new Promise((resolve) => {
    const poll = async () => {
      attempts++;

      const result = await checkB2CStatus(transactionId);

      if (result.success || attempts >= maxAttempts) {
        resolve(result);
      } else {
        setTimeout(poll, intervalMs);
      }
    };

    poll();
  });
};

/**
 * Get B2C transaction history for a withdrawal
 */
export const getB2CTransactionHistory = async (withdrawalId: string) => {
  try {
    const { data, error } = await supabase
      .from('b2c_transactions')
      .select('*')
      .eq('withdrawal_id', withdrawalId)
      .order('initiated_at', { ascending: false });

    if (error) throw error;

    return {
      success: true,
      transactions: data || [],
    };
  } catch (error) {
    console.error('Error fetching B2C transaction history:', error);
    return {
      success: false,
      transactions: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};
