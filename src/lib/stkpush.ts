/**
 * STK Push Service for M-Pesa Integration
 * Handles payment initiation and callback processing
 */

import { supabase } from '@/integrations/supabase/client';

export interface STKPushCallback {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value: string | number;
        }>;
      };
    };
  };
}

interface STKPushFunctionResponse {
  ok?: boolean;
  message?: string;
  bank?: {
    CheckoutRequestID?: string;
    ResponseCode?: string;
    ResponseDescription?: string;
  };
  reference?: string;
  ResponseCode?: string;
  ResponseDescription?: string;
}

/**
 * Initiate STK Push for penalty payment
 */
export async function initiatePenaltySTKPush(
  memberId: string,
  phoneNumber: string,
  totalAmount: number,
  penaltyIds: string[]
): Promise<{ success: boolean; checkoutRequestId?: string; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('coop-stk-push', {
      body: {
        member_id: memberId,
        amount: Math.ceil(totalAmount),
        phone: formatPhoneNumber(phoneNumber),
        accountReference: `PENALTY-${memberId}`,
        transactionDesc: `Penalty Payment - ${penaltyIds.length} penalties`,
        paymentType: 'penalty',
        penaltyIds,
      },
    });

    if (error) {
      console.error('STK Push error:', error);
      return { success: false, error: error.message };
    }

    const response = data as STKPushFunctionResponse;
    const checkoutRequestId = response.bank?.CheckoutRequestID || response.reference || '';
    const success = response.ok === true || response.ResponseCode === '0' || Boolean(checkoutRequestId);

    if (!success) {
      return {
        success: false,
        error: response.message || response.ResponseDescription || 'Failed to initiate payment',
      };
    }

    await supabase.from('penalty_payment_records').insert({
      member_id: memberId,
      amount: totalAmount,
      status: 'pending',
      mpesa_transaction_id: checkoutRequestId,
    });

    return {
      success: true,
      checkoutRequestId,
    };
  } catch (error) {
    console.error('Error initiating STK Push:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Initiate STK Push for donation payment
 */
export async function initiateDonationSTKPush(
  memberId: string,
  campaignId: string,
  amount: number,
  phoneNumber?: string
): Promise<{ success: boolean; checkoutRequestId?: string; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('coop-stk-push', {
      body: {
        member_id: memberId,
        amount: Math.ceil(amount),
        phone: phoneNumber ? formatPhoneNumber(phoneNumber) : undefined,
        reference: `DONATION-${campaignId}-${Date.now()}`,
        accountReference: `DONATION-${campaignId}`,
        transactionDesc: `Donation payment for campaign ${campaignId}`,
        paymentType: 'donation',
        campaignId,
      },
    });

    if (error) {
      console.error('STK Push error:', error);
      return { success: false, error: error.message };
    }

    const response = data as STKPushFunctionResponse;
    const checkoutRequestId = response.bank?.CheckoutRequestID || response.reference || '';
    const success = response.ok === true || response.ResponseCode === '0' || Boolean(checkoutRequestId);

    if (!success) {
      return {
        success: false,
        error: response.message || response.ResponseDescription || 'Failed to initiate donation payment',
      };
    }

    await supabase.from('donation_payment_records').insert({
      member_id: memberId,
      campaign_id: campaignId,
      amount,
      status: 'pending',
      mpesa_transaction_id: checkoutRequestId,
    });

    return {
      success: true,
      checkoutRequestId,
    };
  } catch (error) {
    console.error('Error initiating donation STK Push:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Format phone number to M-Pesa format (254XXXXXXXXX)
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('0')) {
    return '254' + cleaned.substring(1);
  }

  if (cleaned.startsWith('254')) {
    return cleaned;
  }

  return '254' + cleaned;
}

/**
 * Process STK Push callback
 */
export async function processSTKPushCallback(
  callback: STKPushCallback
): Promise<{ success: boolean; message: string }> {
  try {
    const { stkCallback } = callback.Body;
    const { ResultCode, CallbackMetadata, CheckoutRequestID } = stkCallback;

    const metadata = CallbackMetadata?.Item || [];
    const mpesaReceiptNumber = metadata.find((item) => item.Name === 'MpesaReceiptNumber')?.Value as string | undefined;

    if (ResultCode === 0) {
      const { error: penaltyError } = await supabase
        .from('penalty_payment_records')
        .update({
          status: 'verified',
          payment_ref: mpesaReceiptNumber,
          verified_at: new Date().toISOString(),
        })
        .eq('mpesa_transaction_id', CheckoutRequestID);

      const { error: donationError } = await supabase
        .from('donation_payment_records')
        .update({
          status: 'verified',
          payment_ref: mpesaReceiptNumber,
          verified_at: new Date().toISOString(),
        })
        .eq('mpesa_transaction_id', CheckoutRequestID);

      if (penaltyError && donationError) {
        console.error('Error updating payment record:', { penaltyError, donationError });
        return { success: false, message: 'Failed to update payment record' };
      }

      // Update wallet balance for successful donation payments
      if (!donationError) {
        const { data: donationRecord } = await supabase
          .from('donation_payment_records')
          .select('amount')
          .eq('mpesa_transaction_id', CheckoutRequestID)
          .single();

        if (donationRecord) {
          await supabase.rpc('increment', {
            table_name: 'donation_wallet',
            row_id: (await supabase.from('donation_wallet').select('id').single()).data?.id,
            amount: donationRecord.amount,
            field_name: 'total_received'
          });
        }
      }

      return { success: true, message: 'Payment processed successfully' };
    }

    const { error: penaltyError } = await supabase
      .from('penalty_payment_records')
      .update({ status: 'failed' })
      .eq('mpesa_transaction_id', CheckoutRequestID);

    const { error: donationError } = await supabase
      .from('donation_payment_records')
      .update({ status: 'failed' })
      .eq('mpesa_transaction_id', CheckoutRequestID);

    if (penaltyError && donationError) {
      console.error('Error updating failed payment record:', { penaltyError, donationError });
      return { success: false, message: 'Payment failed' };
    }

    return { success: false, message: 'Payment failed' };
  } catch (error) {
    console.error('Error processing STK callback:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get donation payment status
 */
export async function getDonationPaymentStatus(
  checkoutRequestId: string
): Promise<{ status: string; amount?: number; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('donation_payment_records')
      .select('status, amount')
      .eq('mpesa_transaction_id', checkoutRequestId)
      .single();

    if (error) {
      return { status: 'unknown', error: error.message };
    }

    return {
      status: data.status,
      amount: data.amount,
    };
  } catch (error) {
    return {
      status: 'unknown',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
