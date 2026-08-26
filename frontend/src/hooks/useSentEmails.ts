import useSWR from "swr";
import { apiClient } from "@/lib/apiClient";
import { ScheduledEmailRecord } from "@/lib/types";

export function useSentEmails() {
  const { data, error, isLoading, mutate } = useSWR<ScheduledEmailRecord[]>(
    "/api/emails/sent",
    (path: string) => apiClient.get<ScheduledEmailRecord[]>(path),
    {
      refreshInterval: 15000,
      revalidateOnFocus: true,
    }
  );

  return {
    sentEmails: data,
    isLoading,
    error,
    refresh: mutate,
  };
}
