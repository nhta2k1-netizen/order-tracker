/**
 * Nhận diện đơn vị vận chuyển từ mã vận đơn (pattern VN phổ biến).
 * Không 100% chính xác với mã số thuần — fallback = unknown.
 */

/** @typedef {{ id: string, name: string, aliases: string[] }} Carrier */

/** @type {Carrier[]} */
export const CARRIERS = [
  {
    id: "spx",
    name: "Shopee Express",
    aliases: ["SPX", "Shopee Xpress", "ShopeeExpress"],
  },
  {
    id: "ghtk",
    name: "Giao Hàng Tiết Kiệm",
    aliases: ["GHTK"],
  },
  {
    id: "ghn",
    name: "Giao Hàng Nhanh",
    aliases: ["GHN"],
  },
  {
    id: "viettelpost",
    name: "Viettel Post",
    aliases: ["VTP", "ViettelPost"],
  },
  {
    id: "jnt",
    name: "J&T Express",
    aliases: ["J&T", "JT", "JNT"],
  },
  {
    id: "ninjavan",
    name: "Ninja Van",
    aliases: ["NJV", "NinjaVan"],
  },
  {
    id: "best",
    name: "Best Express",
    aliases: ["BEST", "BestExpress"],
  },
  {
    id: "ahamove",
    name: "Ahamove",
    aliases: ["AHAMOVE"],
  },
  {
    id: "grab",
    name: "GrabExpress",
    aliases: ["GRAB"],
  },
  {
    id: "unknown",
    name: "Chưa xác định",
    aliases: [],
  },
];

const CARRIER_MAP = Object.fromEntries(CARRIERS.map((c) => [c.id, c]));

/**
 * @param {string} trackingNumber
 * @returns {{ id: string, name: string, confidence: 'high'|'medium'|'low' }}
 */
export function detectCarrier(trackingNumber) {
  const code = String(trackingNumber || "")
    .trim()
    .toUpperCase();

  if (!code) {
    return { id: "unknown", name: "Chưa xác định", confidence: "low" };
  }

  // Shopee Express VN
  if (
    /^SPXVN/i.test(code) ||
    /^SPX[A-Z0-9]{10,}/i.test(code) ||
    /^VN\d{10,}[A-Z]?$/i.test(code) // một số mã SPX dạng VN…
  ) {
    // VN + digits cũng có thể là Viettel — ưu tiên SPX nếu có SPX prefix
    if (/^SPX/i.test(code)) {
      return { ...CARRIER_MAP.spx, confidence: "high" };
    }
  }

  if (/^SPX/i.test(code)) {
    return { ...CARRIER_MAP.spx, confidence: "high" };
  }

  // GHTK
  if (/^GHTK/i.test(code) || /^S\d{8,}$/i.test(code)) {
    return { ...CARRIER_MAP.ghtk, confidence: /^GHTK/i.test(code) ? "high" : "medium" };
  }

  // GHN — thường 9–12 chữ số hoặc GHN…
  if (/^GHN/i.test(code)) {
    return { ...CARRIER_MAP.ghn, confidence: "high" };
  }
  if (/^\d{9,12}$/.test(code)) {
    // GHN hay dùng dãy số — medium
    return { ...CARRIER_MAP.ghn, confidence: "medium" };
  }

  // J&T
  if (/^JT/i.test(code) || /^JTE/i.test(code) || /^80\d{10,}$/.test(code)) {
    return { ...CARRIER_MAP.jnt, confidence: /^JT/i.test(code) ? "high" : "medium" };
  }

  // Ninja Van VN
  if (/^NVVN/i.test(code) || /^NJV/i.test(code) || /^NV[A-Z0-9]{8,}/i.test(code)) {
    return { ...CARRIER_MAP.ninjavan, confidence: "high" };
  }

  // Best Express
  if (/^BE\d/i.test(code) || /^BEST/i.test(code) || /^848\d{10,}/.test(code)) {
    return { ...CARRIER_MAP.best, confidence: "medium" };
  }

  // Viettel Post — VTP, hoặc dạng chữ+số đặc trưng
  if (/^VTP/i.test(code) || /^VT\d/i.test(code) || /^PX\d/i.test(code)) {
    return { ...CARRIER_MAP.viettelpost, confidence: "high" };
  }

  // Ahamove / Grab (ít dùng mã dài cố định)
  if (/^AH/i.test(code)) {
    return { ...CARRIER_MAP.ahamove, confidence: "medium" };
  }

  return { id: "unknown", name: "Chưa xác định", confidence: "low" };
}

export function getCarrierById(id) {
  return CARRIER_MAP[id] || CARRIER_MAP.unknown;
}
