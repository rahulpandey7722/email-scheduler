import { ScheduledEmailRecord } from "./types";
import { apiClient } from "./apiClient";

const LOCAL_STORAGE_KEY = "email_scheduler_records_v2";

type Listener = () => void;
const listeners = new Set<Listener>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function loadInitialRecords(): ScheduledEmailRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.warn("Failed to load records from localStorage", e);
    return [];
  }
}

function saveRecords(records: ScheduledEmailRecord[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.warn("Failed to save records to localStorage", e);
  }
}

let inMemoryRecords: ScheduledEmailRecord[] = loadInitialRecords();

export const emailStore = {
  getRecords(): ScheduledEmailRecord[] {
    return inMemoryRecords;
  },

  getScheduled(): ScheduledEmailRecord[] {
    return inMemoryRecords.filter(
      (r) => r.status !== "SENT" && r.status !== "FAILED"
    );
  },

  getSent(): ScheduledEmailRecord[] {
    return inMemoryRecords.filter(
      (r) => r.status === "SENT" || r.status === "FAILED"
    );
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async addEmail(input: {
    subject: string;
    body: string;
    recipients: string[];
    scheduledFor: string;
    delayMs?: number;
    hourlyLimit?: number;
  }): Promise<ScheduledEmailRecord> {
    const tempId = `email-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const newRecord: ScheduledEmailRecord = {
      id: tempId,
      subject: input.subject,
      body: input.body,
      scheduledFor: input.scheduledFor,
      status: "QUEUED",
      sentAt: null,
      attempts: 0,
      lastError: null,
      delayMs: input.delayMs ?? 2000,
      hourlyLimit: input.hourlyLimit ?? 200,
      recipients: input.recipients.map((addr) => ({ id: `r-${Date.now()}`, address: addr })),
      createdAt: new Date().toISOString(),
    };

    // 1. Instant local state update
    inMemoryRecords = [newRecord, ...inMemoryRecords.filter((r) => r.id !== tempId)];
    saveRecords(inMemoryRecords);
    notifyListeners();

    // 2. Async backend synchronization
    try {
      const backendRecord = await apiClient.post<ScheduledEmailRecord>("/api/emails", {
        subject: input.subject,
        body: input.body,
        recipients: input.recipients,
        scheduledFor: input.scheduledFor,
        delayMs: input.delayMs,
        hourlyLimit: input.hourlyLimit,
      });

      if (backendRecord && backendRecord.id) {
        inMemoryRecords = inMemoryRecords.map((r) => (r.id === tempId ? backendRecord : r));
        saveRecords(inMemoryRecords);
        notifyListeners();
        return backendRecord;
      }
    } catch (err) {
      console.warn("Backend sync failed, schedule retained in local storage", err);
    }

    return newRecord;
  },

  async fetchFromBackend(): Promise<void> {
    try {
      const [scheduledList, sentList] = await Promise.all([
        apiClient.get<ScheduledEmailRecord[]>("/api/emails/scheduled"),
        apiClient.get<ScheduledEmailRecord[]>("/api/emails/sent"),
      ]);

      if (Array.isArray(scheduledList) || Array.isArray(sentList)) {
        const fetched = [...(scheduledList || []), ...(sentList || [])];
        if (fetched.length > 0) {
          const mergedMap = new Map<string, ScheduledEmailRecord>();
          // Existing items first
          inMemoryRecords.forEach((item) => mergedMap.set(item.id, item));
          // Fetched backend items override
          fetched.forEach((item) => mergedMap.set(item.id, item));

          inMemoryRecords = Array.from(mergedMap.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          saveRecords(inMemoryRecords);
          notifyListeners();
        }
      }
    } catch (err) {
      console.warn("Background fetch from backend failed", err);
    }
  },
};
