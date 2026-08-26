import useSWR from "swr";
import { apiClient } from "@/lib/apiClient";
import { ScheduledEmailRecord } from "@/lib/types";

export function useScheduledEmails() {
  const { data, error, isLoading, mutate } = useSWR<ScheduledEmailRecord[]>(
    "/api/emails/scheduled",
    (path: string) => apiClient.get<ScheduledEmailRecord[]>(path),
    {
      refreshInterval: 10000, // Poll every 10 seconds for dashboard status updates
      revalidateOnFocus: true,
    }
  );

  return {
    scheduledEmails: data,
    isLoading,
    error,
    refresh: mutate,
  };
}
