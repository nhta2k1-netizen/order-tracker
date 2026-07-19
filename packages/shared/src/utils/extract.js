/**
 * Trích mã vận đơn từ text thô hoặc link Shopee / TikTok / SPX / GHN…
 */

const TRACKING_CANDIDATE =
  /\b([A-Z]{2,6}\d{8,}[A-Z0-9]*|\d{8,14}|SPXVN[A-Z0-9]+|SPX[A-Z0-9]+|JT\d+[A-Z0-9]*|GHTK[A-Z0-9]+|GHN[A-Z0-9]+|VN\d{10,}[A-Z0-9]*|NVVN[A-Z0-9]+|BE\d+[A-Z0-9]*)\b/gi;

/** Query params thường chứa mã vận đơn trên link */
const URL_PARAM_KEYS = [
  "tracking",
  "tracking_number",
  "trackingNumber",
  "trackingNo",
  "tracking_no",
  "sls_tn",
  "sls_tracking_number",
  "code",
  "order_sn",
  "orderId",
  "billcode",
  "bill_code",
];

/**
 * @param {string} input
 * @returns {string[]} danh sách mã (đã uppercase, unique)
 */
export function extractTrackingNumbers(input) {
  if (!input || typeof input !== "string") return [];

  const text = input.trim();
  const found = new Set();

  // 1) Từ URL query / path
  const urls = text.match(/https?:\/\/[^\s<>"']+/gi) || [];
  for (const rawUrl of urls) {
    try {
      const u = new URL(rawUrl.replace(/[),.;]+$/, ""));
      for (const key of URL_PARAM_KEYS) {
        const v = u.searchParams.get(key);
        if (v && looksLikeTracking(v)) found.add(normalizeCode(v));
      }
      // path segments: /track/SPXVN... hoặc /SPXVN...
      for (const seg of u.pathname.split("/")) {
        if (looksLikeTracking(seg)) found.add(normalizeCode(seg));
      }
    } catch {
      // ignore invalid URL
    }
  }

  // 2) Regex trên toàn bộ text
  const matches = text.match(TRACKING_CANDIDATE) || [];
  for (const m of matches) {
    if (looksLikeTracking(m)) found.add(normalizeCode(m));
  }

  // 3) Nếu cả chuỗi là 1 mã gọn
  const single = text.replace(/\s+/g, "");
  if (found.size === 0 && looksLikeTracking(single)) {
    found.add(normalizeCode(single));
  }

  return [...found];
}

/**
 * Lấy mã đầu tiên, hoặc null.
 * @param {string} input
 */
export function extractFirstTrackingNumber(input) {
  const list = extractTrackingNumbers(input);
  return list[0] || null;
}

function normalizeCode(code) {
  return String(code).trim().toUpperCase();
}

function looksLikeTracking(code) {
  const c = String(code || "").trim();
  if (c.length < 8 || c.length > 40) return false;
  // loại bỏ số điện thoại VN 10 số bắt đầu 0
  if (/^0\d{9,10}$/.test(c)) return false;
  // phải có chữ hoặc là dãy số dài kiểu bill
  if (!/[A-Z]/i.test(c) && !/^\d{10,14}$/.test(c)) return false;
  return true;
}
