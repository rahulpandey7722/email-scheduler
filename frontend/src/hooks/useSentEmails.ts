import { useState, useEffect } from "react";
import { emailStore } from "@/lib/emailStore";
import { ScheduledEmailRecord } from "@/lib/types";

export function useSentEmails() {
  const [sentEmails, setSentEmails] = useState<ScheduledEmailRecord[]>(
    () => emailStore.getSent()
  );

  useEffect(() => {
    // Sync initial state
    setSentEmails(emailStore.getSent());

    // Subscribe to instant store updates
    const unsubscribe = emailStore.subscribe(() => {
      setSentEmails(emailStore.getSent());
    });

    return unsubscribe;
  }, []);

  return {
    sentEmails,
    isLoading: false,
    error: undefined,
    refresh: () => emailStore.fetchFromBackend(),
  };
}
