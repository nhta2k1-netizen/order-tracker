/**
 * Format kết quả tracking cho Telegram (HTML) và text thuần.
 */

const STATUS_EMOJI = {
  delivered: "✅",
  "đã giao": "✅",
  delivering: "🚚",
  "đang giao": "🚚",
  transit: "📦",
  "vận chuyển": "📦",
  "trung chuyển": "📦",
  pickup: "📥",
  "lấy hàng": "📥",
  return: "↩️",
  hoàn: "↩️",
  fail: "⚠️",
  exception: "⚠️",
  cancel: "❌",
  hủy: "❌",
  hold: "⏸️",
};

/**
 * @param {string|null} status
 */
export function statusEmoji(status) {
  if (!status) return "❔";
  const s = status.toLowerCase();
  for (const [key, emoji] of Object.entries(STATUS_EMOJI)) {
    if (s.includes(key)) return emoji;
  }
  return "📋";
}

/**
 * @param {string|null|Date|number} ts
 */
export function formatTimeVi(ts) {
  if (ts == null) return "—";
  const d =
    typeof ts === "number"
      ? new Date(ts < 1e12 ? ts * 1000 : ts)
      : new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Tin nhắn tra cứu / cập nhật cho Telegram (parse_mode HTML).
 * @param {import('../carriers/track.js').TrackingResult} result
 * @param {{ mode?: 'full'|'update'|'short', prevStatus?: string|null }} [opts]
 */
export function formatTrackingTelegram(result, opts = {}) {
  const mode = opts.mode || "full";
  const emoji = statusEmoji(result.currentStatus);
  const code = escapeHtml(result.trackingNumber || "");
  const carrier = escapeHtml(result.carrierName || result.carrier || "");

  if (!result.ok) {
    return [
      `❌ <b>Không tra cứu được</b>`,
      ``,
      `📦 Mã: <code>${code}</code>`,
      carrier ? `🏷 ĐVVC: ${carrier}` : null,
      `💬 ${escapeHtml(result.error || "Lỗi không xác định")}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (mode === "update") {
    const lines = [
      `🔔 <b>Cập nhật vận đơn</b>`,
      ``,
      `📦 <code>${code}</code>`,
      `🏷 ${carrier}`,
    ];
    if (opts.prevStatus) {
      lines.push(
        `${emoji} <b>${escapeHtml(opts.prevStatus)}</b> → <b>${escapeHtml(result.currentStatus || "")}</b>`
      );
    } else {
      lines.push(`${emoji} <b>${escapeHtml(result.currentStatus || "")}</b>`);
    }
    const latest = result.events?.[0];
    if (latest?.message) {
      lines.push(``);
      lines.push(`📝 ${escapeHtml(latest.message)}`);
      lines.push(`🕒 ${formatTimeVi(latest.timestamp)}`);
    }
    return lines.join("\n");
  }

  // full
  const lines = [
    `${emoji} <b>Trạng thái vận đơn</b>`,
    ``,
    `📦 Mã: <code>${code}</code>`,
    `🏷 ĐVVC: ${carrier}`,
    `📌 Hiện tại: <b>${escapeHtml(result.currentStatus || "—")}</b>`,
  ];

  if (result.estimatedDelivery) {
    lines.push(
      `📅 Dự kiến giao: ${escapeHtml(String(result.estimatedDelivery))}`
    );
  }

  const events = result.events || [];
  if (events.length > 0) {
    lines.push(``);
    lines.push(`<b>📜 Lịch sử</b> (mới → cũ)`);
    const show = mode === "short" ? events.slice(0, 3) : events.slice(0, 8);
    for (const ev of show) {
      const t = formatTimeVi(ev.timestamp);
      const msg = escapeHtml(ev.message || ev.status || "");
      lines.push(`• <i>${t}</i>`);
      lines.push(`  ${msg}`);
    }
    if (events.length > show.length) {
      lines.push(`… +${events.length - show.length} mốc nữa`);
    }
  }

  return lines.join("\n");
}

/**
 * @param {string} text
 */
export function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Help text tiếng Việt.
 */
export function helpText() {
  return [
    `👋 <b>Order Tracker Bot</b>`,
    `Theo dõi đơn Shopee Express & các sàn — chỉ cần mã vận đơn.`,
    ``,
    `<b>Lệnh:</b>`,
    `/track &lt;mã&gt; — tra cứu + bật thông báo`,
    `/status &lt;mã&gt; — xem nhanh (không đổi đăng ký)`,
    `/list — danh sách đang theo dõi`,
    `/untrack &lt;mã&gt; — dừng theo dõi`,
    `/untrack_all — dừng tất cả`,
    `/help — trợ giúp`,
    ``,
    `Hoặc <b>gửi thẳng mã / link</b> đơn hàng.`,
    ``,
    `Ví dụ:`,
    `<code>/track SPXVN0123456789</code>`,
  ].join("\n");
}

/**
 * Format plain text cho Zalo OA (không HTML).
 * @param {import('../carriers/track.js').TrackingResult} result
 * @param {{ mode?: 'full'|'update'|'help', prevStatus?: string|null }} [opts]
 */
export function formatTrackingZalo(result = {}, opts = {}) {
  const mode = opts.mode || "full";
  const code = result.trackingNumber || "";
  const carrier = result.carrierName || result.carrier || "";

  if (mode === "help") {
    return [
      "📦 Order Tracker (Zalo OA — test free)",
      "",
      "Gửi mã vận đơn (vd SPXVN…) để tra cứu + theo dõi.",
      "Lệnh:",
      "• track <mã>",
      "• list",
      "• untrack <mã>",
      "• help",
      "",
      "⚠️ Gói free: OA chỉ reply trong ~48h sau tin nhắn của bạn.",
      "Ngoài 48h cần nhắn lại OA 1 lần để mở khung chat.",
    ].join("\n");
  }

  if (!result.ok) {
    return [
      "❌ Không tra cứu được",
      `📦 Mã: ${code}`,
      carrier ? `🏷 ĐVVC: ${carrier}` : null,
      `💬 ${result.error || "Lỗi không xác định"}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (mode === "update") {
    const lines = [
      "🔔 Cập nhật vận đơn",
      `📦 ${code}`,
      `🏷 ${carrier}`,
    ];
    if (opts.prevStatus) {
      lines.push(`📌 ${opts.prevStatus} → ${result.currentStatus || ""}`);
    } else {
      lines.push(`📌 ${result.currentStatus || ""}`);
    }
    const latest = result.events?.[0];
    if (latest?.message) {
      lines.push(`📝 ${latest.message}`);
      lines.push(`🕒 ${formatTimeVi(latest.timestamp)}`);
    }
    return lines.join("\n");
  }

  const lines = [
    `${statusEmoji(result.currentStatus)} Trạng thái vận đơn`,
    `📦 Mã: ${code}`,
    `🏷 ĐVVC: ${carrier}`,
    `📌 Hiện tại: ${result.currentStatus || "—"}`,
  ];
  const events = result.events || [];
  if (events.length > 0) {
    lines.push("");
    lines.push("📜 Lịch sử (mới → cũ):");
    for (const ev of events.slice(0, 6)) {
      lines.push(`• ${formatTimeVi(ev.timestamp)}`);
      lines.push(`  ${ev.message || ev.status || ""}`);
    }
  }
  return lines.join("\n");
}
