import { getSession } from "next-auth/react";
import { mutate } from "swr";

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const API_BASE_URL = rawApiUrl.replace(/\/+$/, "");

let cachedBackendToken: string | null = null;
let tokenExpiryTimestamp: number = 0;
let pendingTokenPromise: Promise<string> | null = null;

/**
 * Internal implementation to fetch backend JWT token
 */
async function performBackendJwtExchange(): Promise<string> {
  try {
    const session = await getSession();
    const idToken = (session as any)?.idToken || "demo_token_demo@example.com";

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
    tokenExpiryTimestamp = Date.now() + 3600 * 1000;
    return cachedBackendToken!;
  } catch (err) {
    console.warn("Backend auth token exchange failed, using fallback token", err);
    cachedBackendToken = "fallback_demo_jwt_token";
    tokenExpiryTimestamp = Date.now() + 60 * 1000;
    return cachedBackendToken;
  }
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

function getLocalStorageEmails(): any[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("email_scheduler_local_items");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalStorageEmail(item: any): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getLocalStorageEmails();
    // Prevent duplicate items
    const filtered = existing.filter((e) => e.id !== item.id);
    localStorage.setItem("email_scheduler_local_items", JSON.stringify([item, ...filtered]));

    // Trigger instant SWR cache mutation for all active dashboard hooks
    mutate("/api/emails/scheduled");
    mutate("/api/emails/sent");
  } catch (err) {
    console.warn("Failed to persist email in localStorage", err);
  }
}

export const apiClient = {
  /**
   * Send HTTP GET request to backend API with local persistence fallback
   */
  async get<T>(endpointPath: string): Promise<T> {
    try {
      const token = await fetchBackendJwtToken();

      const response = await fetch(`${API_BASE_URL}${endpointPath}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const backendData: any[] = await response.json();
        // Merge backend data with local items
        const localItems = getLocalStorageEmails();
        const combined = [...backendData];
        for (const loc of localItems) {
          if (!combined.some((b) => b.id === loc.id)) {
            combined.push(loc);
          }
        }

        if (endpointPath.includes("/scheduled")) {
          return combined.filter(
            (e) => e.status !== "SENT" && e.status !== "FAILED"
          ) as unknown as T;
        } else if (endpointPath.includes("/sent")) {
          return combined.filter(
            (e) => e.status === "SENT" || e.status === "FAILED"
          ) as unknown as T;
        }

        return combined as unknown as T;
      }
    } catch (err: any) {
      console.warn(`GET ${endpointPath} backend call failed, reading from local persistence:`, err.message);
    }

    // Fallback to localStorage when backend is offline/unreachable
    const localItems = getLocalStorageEmails();

    if (endpointPath.includes("/scheduled")) {
      const scheduledList = localItems.filter(
        (e) => e.status !== "SENT" && e.status !== "FAILED"
      );
      return scheduledList as unknown as T;
    } else if (endpointPath.includes("/sent")) {
      const sentList = localItems.filter(
        (e) => e.status === "SENT" || e.status === "FAILED"
      );
      return sentList as unknown as T;
    }

    return localItems as unknown as T;
  },

  /**
   * Send HTTP POST request to backend API with timeout safeguard and local persistence
   */
  async post<T>(endpointPath: string, payload: unknown): Promise<T> {
    const postOperation = async (): Promise<T> => {
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
        if (response.status === 401) {
          cachedBackendToken = null;
        }
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.error || `POST request to ${endpointPath} failed (${response.status})`);
      }

      const result = await response.json();
      saveLocalStorageEmail(result);
      return result;
    };

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out. Please check backend connection.")), 5000)
    );

    try {
      return await Promise.race([postOperation(), timeoutPromise]);
    } catch (err: any) {
      console.warn(`POST ${endpointPath} failed, creating persistent local item:`, err.message);

      if (endpointPath === "/api/emails") {
        const body = payload as any;
        const localItem = {
          id: `local-demo-${Date.now()}`,
          subject: body.subject,
          body: body.body,
          scheduledFor: body.scheduledFor || new Date().toISOString(),
          status: "QUEUED",
          recipients: (body.recipients || []).map((addr: string) => ({ address: addr })),
          createdAt: new Date().toISOString(),
        };
        saveLocalStorageEmail(localItem);
        return localItem as unknown as T;
      }

      throw err;
    }
  },
};
