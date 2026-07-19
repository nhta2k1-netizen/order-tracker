/** Type declarations for @order-tracker/shared (used by Next.js / TS). */

export type TrackingEvent = {
  status?: string;
  statusRaw?: string;
  message?: string;
  location?: string | null;
  timestamp?: string | null;
  timestampUnix?: number | null;
};

export type TrackingResult = {
  ok: boolean;
  trackingNumber: string;
  carrier: string;
  carrierName: string;
  currentStatus: string | null;
  currentStatusRaw: string | null;
  estimatedDelivery: string | null;
  events: TrackingEvent[];
  raw?: unknown;
  error: string | null;
};

export type TrackOptions = {
  carrierId?: string;
  phoneLast4?: string;
};

export function trackPackage(
  trackingNumber: string,
  opts?: TrackOptions
): Promise<TrackingResult>;

export function detectCarrier(trackingNumber: string): {
  id: string;
  name: string;
  confidence: "high" | "medium" | "low";
  aliases?: string[];
};

export function extractFirstTrackingNumber(input: string): string | null;
export function extractTrackingNumbers(input: string): string[];

export function fetchSpxTracking(
  trackingNumber: string
): Promise<TrackingResult>;
export function fetchGhnTracking(
  trackingNumber: string
): Promise<TrackingResult>;
export function fetchJntTracking(
  trackingNumber: string,
  opts?: { phoneLast4?: string | null }
): Promise<TrackingResult>;
