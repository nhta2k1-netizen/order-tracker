import type { HistoryItem } from "./types";

const KEY = "order-tracker:recent";
const MAX = 12;

export function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as HistoryItem[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveHistoryItem(item: HistoryItem): HistoryItem[] {
  const prev = loadHistory().filter(
    (h) => h.trackingNumber !== item.trackingNumber
  );
  const next = [item, ...prev].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function removeHistoryItem(trackingNumber: string): HistoryItem[] {
  const next = loadHistory().filter((h) => h.trackingNumber !== trackingNumber);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearHistory(): void {
  localStorage.removeItem(KEY);
}
