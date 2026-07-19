/**
 * Router tra cứu theo carrier.
 * Hiện hỗ trợ đầy đủ: SPX. Các hãng khác: stub + hướng mở rộng.
 */
import { detectCarrier } from "./detect.js";
import { fetchSpxTracking } from "./spx.js";
import { fetchGhnTracking } from "./ghn.js";
import { fetchJntTracking } from "./jnt.js";

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
  const rawInput = String(trackingNumber || "").trim();

  // Tách "MÃ|1234" / "MÃ 1234" (4 số cuối SĐT — J&T)
  let phoneLast4 = opts.phoneLast4 ? String(opts.phoneLast4).replace(/\D/g, "").slice(-4) : "";
  let codePart = rawInput;
  const phoneSplit = rawInput.match(/^(.+?)[|,\s]+(\d{4})\s*$/);
  if (phoneSplit) {
    codePart = phoneSplit[1].trim();
    if (!phoneLast4) phoneLast4 = phoneSplit[2];
  }

  const tracking = codePart.replace(/\s+/g, "").toUpperCase();

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

    case "ghn":
      return fetchGhnTracking(tracking);

    case "jnt": {
      const jnt = await fetchJntTracking(tracking, {
        phoneLast4: phoneLast4 || null,
      });
      // 12 số không ra → thử GHN (tránh nhầm carrier)
      if (!jnt.ok && /^\d{9,12}$/.test(tracking) && !/^84\d{10}$/.test(tracking)) {
        const ghn = await fetchGhnTracking(tracking);
        if (ghn.ok) return ghn;
      }
      return jnt;
    }

    // Các carrier khác — phase sau
    case "ghtk":
    case "viettelpost":
    case "ninjavan":
    case "best":
      return unsupportedCarrier(tracking, detected);

    default:
      // Mã VNGH… = GHN (sàn TMĐT)
      if (/^VNGH/i.test(tracking)) {
        return fetchGhnTracking(tracking);
      }
      // Thử SPX trước (nhiều mã Shopee dạng SPXVN / VN…)
      if (/^SPX/i.test(tracking) || /^VN\d/i.test(tracking)) {
        const spx = await fetchSpxTracking(tracking);
        if (spx.ok) return spx;
      }
      // 84… 12 số: J&T
      if (/^84\d{10}$/.test(tracking)) {
        return fetchJntTracking(tracking, {
          phoneLast4: phoneLast4 || null,
        });
      }
      // Mã số thuần 9–12 số: thử GHN rồi J&T
      if (/^\d{9,12}$/.test(tracking)) {
        const ghn = await fetchGhnTracking(tracking);
        if (ghn.ok) return ghn;
        const jnt = await fetchJntTracking(tracking, {
          phoneLast4: phoneLast4 || null,
        });
        if (jnt.ok) return jnt;
        return ghn;
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
          "Chưa nhận diện ĐVVC. Hỗ trợ: SPX (SPXVN…), GHN, J&T (thêm 4 số SĐT nếu cần: MÃ|1234).",
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
