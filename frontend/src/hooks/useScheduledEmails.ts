import useSWR from "swr";
import { apiClient } from "@/lib/apiClient";
import { ScheduledEmailRecord } from "@/lib/types";

export function useScheduledEmails() {
  const { data, error, isLoading, mutate } = useSWR<ScheduledEmailRecord[]>(
    "/api/emails/scheduled",
    (path: string) => apiClient.get<ScheduledEmailRecord[]>(path),
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
      revalidateOnMount: true,
    }
  );

  return {
    scheduledEmails: data ?? [],
    isLoading: isLoading && !data,
    error,
    refresh: mutate,
  };
}
