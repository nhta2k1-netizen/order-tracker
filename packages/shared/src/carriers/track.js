/**
 * Router tra cứu theo carrier.
 * Hiện hỗ trợ đầy đủ: SPX. Các hãng khác: stub + hướng mở rộng.
 */
import { detectCarrier } from "./detect.js";
import { fetchSpxTracking } from "./spx.js";

/**
 * @typedef {object} TrackingEvent
 * @property {string} status
 * @property {string} [statusRaw]
 * @property {string} message
 * @property {string|null} [location]
 * @property {string|null} timestamp ISO
 * @property {number|null} [timestampUnix]
 */

/**
 * @typedef {object} TrackingResult
 * @property {boolean} ok
 * @property {string} trackingNumber
 * @property {string} carrier
 * @property {string} carrierName
 * @property {string|null} currentStatus
 * @property {string|null} currentStatusRaw
 * @property {string|null} estimatedDelivery
 * @property {TrackingEvent[]} events
 * @property {any} raw
 * @property {string|null} error
 */

/**
 * Tra cứu trạng thái theo mã vận đơn.
 * @param {string} trackingNumber
 * @param {{ carrierId?: string }} [opts]
 * @returns {Promise<TrackingResult>}
 */
export async function trackPackage(trackingNumber, opts = {}) {
  const tracking = String(trackingNumber || "")
    .trim()
    .toUpperCase();

  if (!tracking) {
    return {
      ok: false,
      trackingNumber: "",
      carrier: "unknown",
      carrierName: "Chưa xác định",
      currentStatus: null,
      currentStatusRaw: null,
      estimatedDelivery: null,
      events: [],
      raw: null,
      error: "Thiếu mã vận đơn",
    };
  }

  const detected = opts.carrierId
    ? { id: opts.carrierId, name: opts.carrierId, confidence: "high" }
    : detectCarrier(tracking);

  switch (detected.id) {
    case "spx":
      return fetchSpxTracking(tracking);

    // Các carrier khác — phase 2 (Playwright / API public)
    case "ghtk":
    case "ghn":
    case "jnt":
    case "viettelpost":
    case "ninjavan":
    case "best":
      return unsupportedCarrier(tracking, detected);

    default:
      // Thử SPX trước (nhiều mã Shopee dạng SPXVN / VN…)
      if (/^SPX|^VN\d/i.test(tracking)) {
        const spx = await fetchSpxTracking(tracking);
        if (spx.ok) return spx;
      }
      return {
        ok: false,
        trackingNumber: tracking,
        carrier: detected.id,
        carrierName: detected.name,
        currentStatus: null,
        currentStatusRaw: null,
        estimatedDelivery: null,
        events: [],
        raw: null,
        error:
          "Chưa nhận diện được đơn vị vận chuyển. Hiện hỗ trợ tốt nhất: mã Shopee Express (SPXVN…).",
      };
  }
}

function unsupportedCarrier(tracking, detected) {
  return {
    ok: false,
    trackingNumber: tracking,
    carrier: detected.id,
    carrierName: detected.name,
    currentStatus: null,
    currentStatusRaw: null,
    estimatedDelivery: null,
    events: [],
    raw: null,
    error: `${detected.name}: chưa tích hợp tracker (sắp có). Hiện thử mã SPX (Shopee Express) trước.`,
  };
}

/**
 * Phân loại tốc độ poll theo trạng thái.
 * @param {string|null} status
 * @param {string|null} statusRaw
 * @returns {'fast'|'normal'|'slow'|'stop'}
 */
export function pollPriority(status, statusRaw) {
  const s = `${status || ""} ${statusRaw || ""}`.toLowerCase();

  if (
    s.includes("delivered") ||
    s.includes("đã giao") ||
    s.includes("returned") ||
    s.includes("đã hoàn") ||
    s.includes("cancel") ||
    s.includes("hủy")
  ) {
    return "stop";
  }

  if (
    s.includes("delivering") ||
    s.includes("out_for") ||
    s.includes("đang giao") ||
    s.includes("assigned")
  ) {
    return "fast";
  }

  if (
    s.includes("pickup_pending") ||
    s.includes("chờ lấy") ||
    s.includes("created") ||
    s.includes("đã tạo") ||
    !status
  ) {
    return "slow";
  }

  return "normal";
}

export function isTerminalStatus(status, statusRaw) {
  return pollPriority(status, statusRaw) === "stop";
}
