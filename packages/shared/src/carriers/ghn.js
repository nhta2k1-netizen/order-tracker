/**
 * Giao Hàng Nhanh (GHN) — tra cứu public (donhang.ghn.vn).
 * POST https://fe-online-gateway.ghn.vn/order-tracking/public-api/client/tracking-logs
 * Body: { order_code }
 * Không cần token shop (API client public).
 */

const GHN_TRACK_URL =
  "https://fe-online-gateway.ghn.vn/order-tracking/public-api/client/tracking-logs";

const HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Origin: "https://donhang.ghn.vn",
  Referer: "https://donhang.ghn.vn/",
  "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.5",
};

/**
 * @param {string} trackingNumber
 * @returns {Promise<import('./track.js').TrackingResult>}
 */
export async function fetchGhnTracking(trackingNumber) {
  const tracking = String(trackingNumber || "")
    .trim()
    .toUpperCase();

  if (!tracking) {
    return empty(tracking, "Thiếu mã vận đơn");
  }

  let res;
  try {
    res = await fetch(GHN_TRACK_URL, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ order_code: tracking }),
    });
  } catch (err) {
    return empty(tracking, `Lỗi mạng GHN: ${err.message}`);
  }

  let raw;
  try {
    raw = await res.json();
  } catch {
    return empty(tracking, `GHN HTTP ${res.status} — không đọc được JSON`);
  }

  // code 200 = OK (theo frontend donhang.ghn.vn)
  if (raw.code !== 200 || !raw.data) {
    const msg =
      raw.code_message_value ||
      raw.message ||
      raw.code_message ||
      (raw.code === 400
        ? "Không tìm thấy đơn GHN (sai mã hoặc chưa lên hệ thống)"
        : `GHN lỗi ${raw.code ?? res.status}`);
    return {
      ...empty(tracking, msg),
      raw,
    };
  }

  const data = raw.data;
  const orderInfo = data.order_info || data.orderInfo || {};
  const logs = Array.isArray(data.tracking_logs)
    ? data.tracking_logs
    : Array.isArray(data.trackingLogs)
      ? data.trackingLogs
      : [];

  const events = logs
    .map((item) => normalizeLog(item))
    .filter(Boolean)
    // newest first
    .sort((a, b) => (b.timestampUnix || 0) - (a.timestampUnix || 0));

  const currentStatusRaw =
    orderInfo.status ||
    orderInfo.status_name ||
    orderInfo.status_ops_name ||
    events[0]?.statusRaw ||
    events[0]?.status ||
    null;

  const currentStatus =
    orderInfo.status_name ||
    orderInfo.status_ops_name ||
    events[0]?.status ||
    currentStatusRaw;

  const orderCode =
    orderInfo.order_code ||
    orderInfo.orderCode ||
    data.order_code ||
    tracking;

  let estimatedDelivery = null;
  if (orderInfo.leadtime || orderInfo.leadtime_order) {
    const lt = orderInfo.leadtime_order || orderInfo.leadtime;
    estimatedDelivery = formatMaybeDate(lt);
  }

  return {
    ok: true,
    trackingNumber: String(orderCode).toUpperCase(),
    carrier: "ghn",
    carrierName: "Giao Hàng Nhanh",
    currentStatus: currentStatus ? String(currentStatus) : null,
    currentStatusRaw: currentStatusRaw ? String(currentStatusRaw) : null,
    estimatedDelivery,
    events,
    raw,
    error: null,
  };
}

function normalizeLog(item) {
  if (!item || typeof item !== "object") return null;

  const statusRaw = item.status || item.status_code || "";
  const status =
    item.status_name ||
    item.status_ops_name ||
    item.status_transiting_name ||
    statusRaw ||
    "Cập nhật";

  const messageParts = [
    item.content,
    item.detail,
    item.description,
    item.reason,
    item.note,
  ].filter((x) => x && String(x).trim());

  const warehouse =
    item.warehouse_name ||
    item.location ||
    item.current_warehouse_name ||
    null;

  let message =
    messageParts.join(" — ") ||
    String(status) ||
    "Cập nhật trạng thái";

  if (warehouse && !String(message).includes(String(warehouse))) {
    message = `${message} (${warehouse})`;
  }

  const tsRaw =
    item.action_at ||
    item.created_date ||
    item.time ||
    item.created_at ||
    null;

  const { iso, unix } = parseTime(tsRaw);

  return {
    status: String(status),
    statusRaw: statusRaw ? String(statusRaw) : String(status),
    message: String(message),
    location: warehouse ? String(warehouse) : null,
    timestamp: iso,
    timestampUnix: unix,
  };
}

function parseTime(tsRaw) {
  if (tsRaw == null || tsRaw === "") {
    return { iso: null, unix: null };
  }
  if (typeof tsRaw === "number") {
    const ms = tsRaw < 1e12 ? tsRaw * 1000 : tsRaw;
    return { iso: new Date(ms).toISOString(), unix: Math.floor(ms / 1000) };
  }
  const d = new Date(tsRaw);
  if (Number.isNaN(d.getTime())) {
    return { iso: String(tsRaw), unix: null };
  }
  return { iso: d.toISOString(), unix: Math.floor(d.getTime() / 1000) };
}

function formatMaybeDate(v) {
  if (v == null) return null;
  if (typeof v === "number") {
    const ms = v < 1e12 ? v * 1000 : v;
    return new Date(ms).toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
    });
  }
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  }
  return String(v);
}

function empty(tracking, error) {
  return {
    ok: false,
    trackingNumber: tracking,
    carrier: "ghn",
    carrierName: "Giao Hàng Nhanh",
    currentStatus: null,
    currentStatusRaw: null,
    estimatedDelivery: null,
    events: [],
    raw: null,
    error,
  };
}
