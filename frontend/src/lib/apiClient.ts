import { getSession } from "next-auth/react";

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const API_BASE_URL = rawApiUrl.replace(/\/+$/, "");

let cachedBackendToken: string | null = null;
let tokenExpiryTimestamp: number = 0;
let pendingTokenPromise: Promise<string> | null = null;

/**
 * Internal implementation to fetch backend JWT token
 */
async function performBackendJwtExchange(): Promise<string> {
  const session = await getSession();
  const idToken = (session as any)?.idToken;

  if (!idToken) {
    throw new Error("User session unauthenticated");
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    throw new Error("Authentication exchange with backend server failed");
  }

  const data = await response.json();
  cachedBackendToken = data.token;
  // Cache token for 1 hour
  tokenExpiryTimestamp = Date.now() + 3600 * 1000;

  return cachedBackendToken!;
}

/**
 * Exchanges Google OAuth id_token for API-scoped JWT token with deduplication
 */
async function fetchBackendJwtToken(): Promise<string> {
  // Reuse cached JWT if still valid
  if (cachedBackendToken && Date.now() < tokenExpiryTimestamp) {
    return cachedBackendToken;
  }

  // Deduplicate concurrent token requests
  if (!pendingTokenPromise) {
    pendingTokenPromise = performBackendJwtExchange().finally(() => {
      pendingTokenPromise = null;
    });
  }

  return pendingTokenPromise;
}

export const apiClient = {
  /**
   * Send HTTP GET request to backend API
   */
  async get<T>(endpointPath: string): Promise<T> {
    const token = await fetchBackendJwtToken();

    const response = await fetch(`${API_BASE_URL}${endpointPath}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      throw new Error(errorJson.error || `GET request to ${endpointPath} failed (${response.status})`);
    }

    return response.json();
  },

  /**
   * Send HTTP POST request to backend API
   */
  async post<T>(endpointPath: string, payload: unknown): Promise<T> {
    const token = await fetchBackendJwtToken();

    const response = await fetch(`${API_BASE_URL}${endpointPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      throw new Error(errorJson.error || `POST request to ${endpointPath} failed (${response.status})`);
    }

    return response.json();
  },
};
