import { useState, useEffect } from "react";
import { emailStore } from "@/lib/emailStore";
import { ScheduledEmailRecord } from "@/lib/types";

export function useScheduledEmails() {
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmailRecord[]>(
    () => emailStore.getScheduled()
  );

  useEffect(() => {
    // Sync initial state
    setScheduledEmails(emailStore.getScheduled());

    // Subscribe to instant store updates
    const unsubscribe = emailStore.subscribe(() => {
      setScheduledEmails(emailStore.getScheduled());
    });

    // Trigger background sync with backend
    emailStore.fetchFromBackend();

    return unsubscribe;
  }, []);

  return {
    scheduledEmails,
    isLoading: false,
    error: undefined,
    refresh: () => emailStore.fetchFromBackend(),
  };
}
