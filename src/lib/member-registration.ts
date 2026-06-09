/**
 * Member Registration Service
 * Frontend integration for new member registration API
 */

import { supabase } from "@/integrations/supabase/client";

interface RegistrationFormData {
  full_name: string;
  phone_number: string;
  department: string;
  working_location: string;
  date_of_birth?: string;
}

interface RegistrationConfig {
  retiring_date: string;
  registration_fee: number;
  active: boolean;
  message?: string;
}

interface RegistrationResponse {
  success: boolean;
  registration_id?: string;
  status?: string;
  registration_fee?: number;
  message: string;
  error?: string;
}

interface PaymentResponse {
  success: boolean;
  checkout_request_id?: string;
  message: string;
  error?: string;
}

interface StatusResponse {
  success: boolean;
  registration_id?: string;
  status?: string;
  payment_status?: string;
  created_at?: string;
  verified_at?: string;
  message: string;
}

const API_BASE_URL = Deno.env.get("SUPABASE_URL") || "https://your-project.supabase.co";

/**
 * Get current registration configuration and requirements
 */
export async function getRegistrationConfig(): Promise<RegistrationConfig> {
  try {
    const response = await fetch(`${API_BASE_URL}/functions/v1/member-registration/config`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch registration config");
    }

    const data = await response.json();
    return data.data || {
      retiring_date: "2027-12-31",
      registration_fee: 1000,
      active: true,
    };
  } catch (error) {
    console.error("Config fetch error:", error);
    return {
      retiring_date: "2027-12-31",
      registration_fee: 1000,
      active: true,
      message: "Join our welfare group",
    };
  }
}

/**
 * Submit new member registration
 */
export async function submitRegistration(
  formData: RegistrationFormData
): Promise<RegistrationResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/functions/v1/member-registration/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.error || "Registration failed",
      };
    }

    return {
      success: true,
      registration_id: data.registration_id,
      status: data.status,
      registration_fee: data.registration_fee,
      message: data.message,
    };
  } catch (error) {
    console.error("Registration error:", error);
    return {
      success: false,
      message: "Network error. Please try again.",
    };
  }
}

/**
 * Initiate M-Pesa payment for registration fee
 */
export async function initiateRegistrationPayment(
  registrationId: string,
  phoneNumber: string
): Promise<PaymentResponse> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/functions/v1/member-registration/initiate-payment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          registration_id: registrationId,
          phone_number: phoneNumber,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.error || "Payment initiation failed",
      };
    }

    return {
      success: true,
      checkout_request_id: data.checkout_request_id,
      message: data.message,
    };
  } catch (error) {
    console.error("Payment initiation error:", error);
    return {
      success: false,
      message: "Network error. Please try again.",
    };
  }
}

/**
 * Check registration status
 */
export async function checkRegistrationStatus(
  registrationId: string
): Promise<StatusResponse> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/functions/v1/member-registration/status/${registrationId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.error || "Failed to check status",
      };
    }

    return {
      success: true,
      registration_id: data.registration_id,
      status: data.status,
      payment_status: data.payment_status,
      created_at: data.created_at,
      verified_at: data.verified_at,
      message: data.message,
    };
  } catch (error) {
    console.error("Status check error:", error);
    return {
      success: false,
      message: "Network error. Please try again.",
    };
  }
}

/**
 * Validate phone number format
 */
export function validatePhoneNumber(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return /^(0[17]|254[17])\d{8}$/.test(digits) || /^254[17]\d{8}$/.test(digits);
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Format phone number to standard format (0712345678)
 */
export function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("254")) {
    return "0" + digits.substring(3);
  }

  if (digits.length === 9) {
    return "0" + digits;
  }

  return phone;
}

/**
 * Get status badge display
 */
export function getStatusBadge(status: string): { label: string; variant: string } {
  const statusMap: Record<string, { label: string; variant: string }> = {
    pending: { label: "Pending", variant: "secondary" },
    payment_pending: { label: "Awaiting Payment", variant: "warning" },
    verified: { label: "Payment Verified", variant: "info" },
    approved: { label: "Approved", variant: "success" },
    active: { label: "Active Member", variant: "success" },
    rejected: { label: "Rejected", variant: "destructive" },
  };

  return statusMap[status] || { label: status, variant: "secondary" };
}

/**
 * Get payment status badge display
 */
export function getPaymentStatusBadge(
  status: string
): { label: string; variant: string } {
  const statusMap: Record<string, { label: string; variant: string }> = {
    unpaid: { label: "Unpaid", variant: "destructive" },
    pending: { label: "Pending", variant: "warning" },
    paid: { label: "Paid", variant: "success" },
    verified: { label: "Verified", variant: "success" },
    failed: { label: "Failed", variant: "destructive" },
  };

  return statusMap[status] || { label: status, variant: "secondary" };
}
