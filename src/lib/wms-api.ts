/**
 * Welfare Management System (WMS) API Integration
 * Handles all communication with the external/Supabase WMS functions
 */

const WMS_API_BASE = import.meta.env.VITE_WMS_API_BASE || "https://ubdhljxyleqsixrewtto.supabase.co/functions/v1";

interface WmsRequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

interface WmsError {
  message: string;
  code?: string;
  status?: number;
}

class WmsApiError extends Error implements WmsError {
  code?: string;
  status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = "WmsApiError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Make authenticated request to WMS API with CORS support
 */
export async function wmsApiCall<T = any>(
  endpoint: string,
  options: WmsRequestOptions = {}
): Promise<T> {
  const url = `${WMS_API_BASE}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  
  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    ...options.headers,
  };

  try {
    console.log(`[WMS API] Calling ${url}...`);
    
    const response = await fetch(url, {
      ...options,
      headers: defaultHeaders,
      mode: 'cors',
      credentials: 'include',
    });

    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: response.statusText };
      }

      const errorMsg = errorData.error || errorData.message || `WMS API Error: ${response.status} ${response.statusText}`;
      console.error(`[WMS API] Error (${response.status}):`, errorMsg);
      
      throw new WmsApiError(errorMsg, `HTTP_${response.status}`, response.status);
    }

    const data = await response.json();
    console.log(`[WMS API] Success:`, data);
    return data;
  } catch (error: any) {
    // Handle network/CORS errors
    if (error instanceof TypeError) {
      const corsMsg = `Unable to reach the Welfare Management System. This is usually a CORS or network issue. Verify VITE_WMS_API_BASE and that the API allows this origin. (${error.message})`;
      console.error(`[WMS API] Network Error:`, corsMsg);
      throw new WmsApiError(corsMsg, 'CORS_OR_NETWORK', 0);
    }
    
    // Re-throw if already a WmsApiError
    if (error instanceof WmsApiError) {
      throw error;
    }
    
    console.error(`[WMS API] Unexpected error (${endpoint}):`, error);
    throw new WmsApiError(error.message || "Unknown error", 'UNKNOWN');
  }
}

/**
 * Health check to verify WMS API is accessible
 */
export async function checkWmsHealth(): Promise<{ status: 'ok' | 'error'; message: string }> {
  try {
    const result = await wmsApiCall("/health", { method: "GET" });
    return { status: 'ok', message: "WMS API is accessible" };
  } catch (error: any) {
    return { status: 'error', message: error.message || "WMS API is not accessible" };
  }
}

/**
 * Get member data from WMS
 */
export async function getMemberFromWms(memberId: string, token?: string): Promise<any> {
  return wmsApiCall(`/members/${memberId}`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/**
 * Get all members from WMS with pagination
 */
export async function getMembersFromWms(
  page: number = 1,
  limit: number = 50,
  token?: string
): Promise<any> {
  return wmsApiCall(`/members?page=${page}&limit=${limit}`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/**
 * Sync member data to WMS
 */
export async function syncMemberToWms(memberData: any, token?: string): Promise<any> {
  return wmsApiCall("/members", {
    method: "POST",
    body: JSON.stringify(memberData),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/**
 * Update member in WMS
 */
export async function updateMemberInWms(memberId: string, memberData: any, token?: string): Promise<any> {
  return wmsApiCall(`/members/${memberId}`, {
    method: "PUT",
    body: JSON.stringify(memberData),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/**
 * Get contribution/fee data from WMS
 */
export async function getContributionsFromWms(
  memberId?: string,
  token?: string
): Promise<any> {
  const endpoint = memberId ? `/contributions/${memberId}` : "/contributions";
  return wmsApiCall(endpoint, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/**
 * Record contribution in WMS
 */
export async function recordContributionInWms(
  contributionData: any,
  token?: string
): Promise<any> {
  return wmsApiCall("/contributions", {
    method: "POST",
    body: JSON.stringify(contributionData),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/**
 * Get benefits/payouts from WMS
 */
export async function getBenefitsFromWms(
  memberId?: string,
  token?: string
): Promise<any> {
  const endpoint = memberId ? `/benefits/${memberId}` : "/benefits";
  return wmsApiCall(endpoint, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/**
 * Process payout in WMS
 */
export async function processPayoutInWms(
  payoutData: any,
  token?: string
): Promise<any> {
  return wmsApiCall("/benefits/payout", {
    method: "POST",
    body: JSON.stringify(payoutData),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export default {
  wmsApiCall,
  getMemberFromWms,
  getMembersFromWms,
  syncMemberToWms,
  updateMemberInWms,
  getContributionsFromWms,
  recordContributionInWms,
  getBenefitsFromWms,
  processPayoutInWms,
  checkWmsHealth,
  WmsApiError,
};
