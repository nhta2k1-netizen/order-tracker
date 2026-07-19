/**
 * J&T Express Việt Nam — tra cứu qua trang public jtexpress.vn
 *
 * GET https://jtexpress.vn/tracking?type=track&billcode=...&cellphone=...
 * - billcode: mã vận đơn (vd 84xxxxxxxxxx)
 * - cellphone: 4 số cuối SĐT người nhận (J&T đôi khi yêu cầu; tùy chọn)
 *
 * Không cần API key. Parse HTML kết quả.
 */
import { buildOrderDetails } from "../utils/order-details.js";

const TRACK_URL = "https://jtexpress.vn/tracking";

const HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.5",
  Referer: "https://jtexpress.vn/vi/tracking?type=track",
};

/**
 * @param {string} trackingNumber
 * @param {{ phoneLast4?: string|null }} [opts]
 * @returns {Promise<import('./track.js').TrackingResult>}
 */
export async function fetchJntTracking(trackingNumber, opts = {}) {
  const tracking = normalizeBill(trackingNumber);
  if (!tracking) {
    return empty("", "Thiếu mã vận đơn J&T");
  }

  // Hỗ trợ "MÃ 1234" hoặc "MÃ|1234" (4 số cuối SĐT)
  let bill = tracking;
  let phone = opts.phoneLast4 ? String(opts.phoneLast4).replace(/\D/g, "").slice(-4) : "";

  const split = String(trackingNumber || "").match(
    /^([A-Z0-9][A-Z0-9\-]+)\s*[|,\s]\s*(\d{4})\s*$/i
  );
  if (split) {
    bill = normalizeBill(split[1]);
    phone = split[2];
  }

  const url = new URL(TRACK_URL);
  url.searchParams.set("type", "track");
  url.searchParams.set("billcode", bill);
  if (phone && phone.length === 4) {
    url.searchParams.set("cellphone", phone);
  }

  let html;
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: HEADERS,
      redirect: "follow",
    });
    html = await res.text();
    if (!res.ok && res.status >= 500) {
      return empty(bill, `J&T HTTP ${res.status}`);
    }
  } catch (err) {
    return empty(bill, `Lỗi mạng J&T: ${err.message}`);
  }

  return parseTrackingHtml(bill, html, { triedPhone: Boolean(phone) });
}

function normalizeBill(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

/**
 * @param {string} bill
 * @param {string} html
 * @param {{ triedPhone?: boolean }} meta
 */
function parseTrackingHtml(bill, html, meta = {}) {
  const text = html || "";

  // Không tìm thấy
  if (
    /empty-vandon/i.test(text) ||
    /Không tìm thấy dữ liệu về vận đơn/i.test(text) ||
    /không tìm thấy.*vận đơn/i.test(text)
  ) {
    // Phân biệt thiếu SĐT vs sai mã — trang hay hiện modal SĐT
    if (
      !meta.triedPhone &&
      (/cellphone/i.test(text) || /số điện thoại/i.test(text))
    ) {
      return empty(
        bill,
        "J&T: không thấy dữ liệu. Thử kèm 4 số cuối SĐT người nhận, ví dụ: " +
          `${bill} 1234 (hoặc ${bill}|1234).`
      );
    }
    return empty(
      bill,
      "Không tìm thấy vận đơn J&T (sai mã, chưa lên hệ thống, hoặc cần 4 số cuối SĐT người nhận)."
    );
  }

  if (/Số điện thoại không tồn tại/i.test(text) || /số điện thoại không/i.test(text)) {
    return empty(
      bill,
      "J&T: 4 số cuối SĐT không khớp. Kiểm tra lại SĐT người nhận trên đơn."
    );
  }

  // Lấy khối result-tracking
  let section = extractSection(text, "result-tracking");
  if (!section || /empty-vandon/i.test(section)) {
    // fallback toàn trang (bỏ script/style)
    section = stripTagsKeepText(text);
  } else {
    section = stripTagsKeepText(section);
  }

  const events = extractEvents(section);

  if (events.length === 0) {
    // Có thể trang chỉ hiện tóm tắt
    const summary = extractSummaryStatus(section);
    if (summary) {
      return {
        ok: true,
        trackingNumber: bill,
        carrier: "jnt",
        carrierName: "J&T Express",
        currentStatus: summary,
        currentStatusRaw: summary,
        estimatedDelivery: null,
        orderDetails: buildOrderDetails(),
        events: [
          {
            status: summary,
            statusRaw: summary,
            message: summary,
            location: null,
            timestamp: null,
            timestampUnix: null,
          },
        ],
        raw: { source: "jtexpress.vn", note: "summary-only" },
        error: null,
      };
    }

    return empty(
      bill,
      "J&T: không parse được lịch sử. Thử kèm 4 số cuối SĐT: " +
        `${bill}|xxxx — hoặc tra trên jtexpress.vn/tracking`
    );
  }

  const current = events[0];
  return {
    ok: true,
    trackingNumber: bill,
    carrier: "jnt",
    carrierName: "J&T Express",
    currentStatus: current.status || current.message,
    currentStatusRaw: current.statusRaw || current.status,
    estimatedDelivery: null,
    orderDetails: buildOrderDetails(),
    events,
    raw: { source: "jtexpress.vn", eventCount: events.length },
    error: null,
  };
}

function extractSection(html, className) {
  const re = new RegExp(
    `<div[^>]*class="[^"]*${className}[^"]*"[^>]*>([\\s\\S]*?)(?=<div[^>]*class="[^"]*result-|$)`,
    "i"
  );
  const m = html.match(re);
  return m ? m[1] : null;
}

function stripTagsKeepText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

/**
 * Trích các mốc: ngày giờ + mô tả.
 * Hỗ trợ: 19/07/2026 14:30, 2026-07-19 14:30:00, 19-07-2026
 */
function extractEvents(text) {
  const lines = String(text)
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2);

  const events = [];
  const dateRe =
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dm = line.match(dateRe);
    if (!dm) continue;

    const dateStr = dm[1];
    let message = line.replace(dateStr, "").replace(/^[\s\-–|·:]+|[\s\-–|·:]+$/g, "");
    // gộp dòng sau nếu không có ngày
    if ((!message || message.length < 3) && lines[i + 1] && !dateRe.test(lines[i + 1])) {
      message = lines[i + 1];
      i += 1;
    }
    if (!message || message.length < 2) continue;
    // bỏ dòng rác UI
    if (/cookie|đăng nhập|j&t express việt nam|tra cứu/i.test(message) && message.length < 40) {
      continue;
    }

    const { iso, unix } = parseViDate(dateStr);
    const status = guessStatus(message);

    events.push({
      status,
      statusRaw: status,
      message,
      location: extractLocation(message),
      timestamp: iso,
      timestampUnix: unix,
    });
  }

  // newest first
  events.sort((a, b) => (b.timestampUnix || 0) - (a.timestampUnix || 0));
  // unique by message+time
  const seen = new Set();
  return events.filter((e) => {
    const k = `${e.timestamp}|${e.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function extractSummaryStatus(text) {
  const keywords = [
    /đã giao(?: hàng)?(?: thành công)?/i,
    /đang giao(?: hàng)?/i,
    /đang vận chuyển/i,
    /đã lấy hàng/i,
    /chờ lấy hàng/i,
    /hoàn hàng/i,
    /hủy/i,
  ];
  for (const re of keywords) {
    const m = text.match(re);
    if (m) return m[0];
  }
  return null;
}

function guessStatus(message) {
  const s = message.toLowerCase();
  if (s.includes("đã giao") || s.includes("giao thành công")) return "Đã giao thành công";
  if (s.includes("đang giao") || s.includes("phát hàng")) return "Đang giao hàng";
  if (s.includes("vận chuyển") || s.includes("trung chuyển") || s.includes("đến bưu cục"))
    return "Đang vận chuyển";
  if (s.includes("đã lấy") || s.includes("lấy hàng")) return "Đã lấy hàng";
  if (s.includes("chờ lấy") || s.includes("nhập kho gửi")) return "Chờ lấy hàng";
  if (s.includes("hoàn")) return "Hoàn hàng";
  if (s.includes("hủy")) return "Đã hủy";
  // lấy 80 ký tự đầu làm status ngắn
  return message.length > 60 ? message.slice(0, 57) + "…" : message;
}

function extractLocation(message) {
  const m = String(message).match(
    /(?:tại|đến|qua|kho|BC|bưu cục)\s+([A-Za-zÀ-ỹ0-9\s,.\-]{3,40})/i
  );
  return m ? m[1].trim() : null;
}

function parseViDate(str) {
  const s = String(str).trim();
  // dd/mm/yyyy HH:mm
  let m = s.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    const d = new Date(
      y,
      Number(m[2]) - 1,
      Number(m[1]),
      Number(m[4] || 0),
      Number(m[5] || 0),
      Number(m[6] || 0)
    );
    if (!Number.isNaN(d.getTime())) {
      return { iso: d.toISOString(), unix: Math.floor(d.getTime() / 1000) };
    }
  }
  // yyyy-mm-dd
  const d2 = new Date(s.replace(" ", "T"));
  if (!Number.isNaN(d2.getTime())) {
    return { iso: d2.toISOString(), unix: Math.floor(d2.getTime() / 1000) };
  }
  return { iso: null, unix: null };
}

function empty(tracking, error) {
  return {
    ok: false,
    trackingNumber: tracking,
    carrier: "jnt",
    carrierName: "J&T Express",
    currentStatus: null,
    currentStatusRaw: null,
    estimatedDelivery: null,
    orderDetails: buildOrderDetails(),
    events: [],
    raw: null,
    error,
  };
}
