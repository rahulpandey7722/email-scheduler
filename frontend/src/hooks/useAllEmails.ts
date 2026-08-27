import { useState, useEffect } from "react";
import { emailStore } from "@/lib/emailStore";
import { ScheduledEmailRecord } from "@/lib/types";

export function useAllEmails() {
  const [allEmails, setAllEmails] = useState<ScheduledEmailRecord[]>(
    () => emailStore.getAllHistory()
  );

  useEffect(() => {
    // Sync initial state
    setAllEmails(emailStore.getAllHistory());

    // Subscribe to instant store updates
    const unsubscribe = emailStore.subscribe(() => {
      setAllEmails(emailStore.getAllHistory());
    });

    // Trigger background sync with backend
    emailStore.fetchFromBackend();

    return unsubscribe;
  }, []);

  return {
    allEmails,
    isLoading: false,
    error: undefined,
    refresh: () => emailStore.fetchFromBackend(),
  };
}
