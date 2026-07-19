export type TrackingEvent = {
  status?: string;
  statusRaw?: string;
  message?: string;
  location?: string | null;
  timestamp?: string | null;
  timestampUnix?: number | null;
};

export type OrderItem = {
  name: string;
  quantity?: number | null;
  weight?: string | null;
};

export type OrderDetails = {
  recipientName?: string | null;
  recipientPhone?: string | null;
  recipientAddress?: string | null;
  senderName?: string | null;
  senderPhone?: string | null;
  senderAddress?: string | null;
  productName?: string | null;
  items?: OrderItem[];
  clientOrderCode?: string | null;
  note?: string | null;
  codAmount?: string | null;
};

export type TrackingResult = {
  ok: boolean;
  trackingNumber: string;
  carrier: string;
  carrierName: string;
  currentStatus: string | null;
  currentStatusRaw: string | null;
  estimatedDelivery: string | null;
  orderDetails?: OrderDetails | null;
  events: TrackingEvent[];
  error: string | null;
};

export type HistoryItem = {
  trackingNumber: string;
  carrierName?: string;
  currentStatus?: string | null;
  /** Tên SP do user ghi (Shopee không public API) */
  productName?: string | null;
  lookedAt: string;
};
