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
  error: string | null;
};

export type HistoryItem = {
  trackingNumber: string;
  carrierName?: string;
  currentStatus?: string | null;
  lookedAt: string;
};
