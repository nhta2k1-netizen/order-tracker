/**
 * Xử lý tin nhắn user → Zalo OA (test free trong khung 48h).
 */
import {
  subscribeZalo,
  listZaloSubscriptionsByUser,
  unsubscribeZalo,
  replaceHistory,
  upsertZaloUser,
} from "@order-tracker/db";
import {
  trackPackage,
  extractTrackingNumbers,
  extractFirstTrackingNumber,
  formatTrackingZalo,
  sendZaloText,
  detectCarrier,
} from "@order-tracker/shared";

/**
 * @param {string} userId
 * @param {string} text
 */
export async function handleZaloUserText(userId, text) {
  const raw = String(text || "").trim();
  upsertZaloUser({ userId, touchMessage: true });

  if (!raw) {
    await safeSend(userId, formatTrackingZalo({}, { mode: "help" }));
    return;
  }

  const lower = raw.toLowerCase();

  // help
  if (
    lower === "help" ||
    lower === "huong dan" ||
    lower === "hướng dẫn" ||
    lower === "menu" ||
    lower === "start"
  ) {
    await safeSend(userId, formatTrackingZalo({}, { mode: "help" }));
    return;
  }

  // list
  if (lower === "list" || lower === "ds" || lower === "danh sách") {
    const rows = listZaloSubscriptionsByUser(userId);
    if (rows.length === 0) {
      await safeSend(
        userId,
        "📭 Chưa theo dõi mã nào.\nGửi mã SPXVN… để bắt đầu."
      );
      return;
    }
    const lines = [`📋 Đang theo dõi (${rows.length})`, ""];
    for (const r of rows) {
      lines.push(`📦 ${r.tracking_number}`);
      lines.push(
        `   ${r.carrier_name || "?"} · ${r.current_status || "Chưa có TT"}`
      );
    }
    lines.push("", "Dừng: untrack <mã>");
    await safeSend(userId, lines.join("\n"));
    return;
  }

  // untrack
  if (lower.startsWith("untrack") || lower.startsWith("huy ")) {
    const code =
      extractFirstTrackingNumber(raw) ||
      raw.replace(/^(untrack|huy)\s*/i, "").trim().toUpperCase();
    if (!code) {
      await safeSend(userId, "Dùng: untrack SPXVN…");
      return;
    }
    const res = unsubscribeZalo(userId, code);
    if (!res.ok) {
      await safeSend(userId, "❌ Không tìm thấy đăng ký mã này.");
      return;
    }
    await safeSend(userId, `🛑 Đã dừng theo dõi ${res.package.tracking_number}`);
    return;
  }

  // track <mã> hoặc chỉ gửi mã / link
  let codes = extractTrackingNumbers(raw);
  if (lower.startsWith("track ")) {
    const rest = raw.slice(6);
    codes = extractTrackingNumbers(rest);
    if (codes.length === 0) {
      const c = rest.trim().toUpperCase();
      if (c.length >= 8) codes = [c];
    }
  }

  if (codes.length === 0) {
    await safeSend(
      userId,
      "🤔 Không thấy mã vận đơn.\nGửi SPXVN… hoặc gõ help"
    );
    return;
  }

  for (const code of codes.slice(0, 3)) {
    await trackAndSubscribeZalo(userId, code);
  }
}

/**
 * @param {string} userId
 * @param {string} trackingNumber
 */
export async function trackAndSubscribeZalo(userId, trackingNumber) {
  const code = String(trackingNumber).trim().toUpperCase();
  const detected = detectCarrier(code);

  await safeSend(
    userId,
    `⏳ Đang tra cứu ${code} (${detected.name})…`
  );

  const result = await trackPackage(code);
  const latestMsg = result.events?.[0]?.message || result.currentStatus || null;

  const { package: pkg } = subscribeZalo({
    userId,
    trackingNumber: code,
    carrier: result.carrier || detected.id,
    carrierName: result.carrierName || detected.name,
    currentStatus: result.currentStatus,
    currentStatusRaw: result.currentStatusRaw,
    lastMessage: latestMsg,
  });

  if (result.ok && result.events?.length) {
    replaceHistory(pkg.id, result.events);
  }

  const body = formatTrackingZalo(result, { mode: "full" });
  const footer = result.ok
    ? `\n\n🔔 Đã bật thông báo (trong khung 48h chat).\nNgoài 48h: nhắn lại OA 1 lần rồi đợi cập nhật.\nlist · untrack ${code}`
    : `\n\n🔔 Đã đăng ký — sẽ báo khi có dữ liệu (trong 48h).\nuntrack ${code}`;

  await safeSend(userId, body + footer);
}

async function safeSend(userId, text) {
  try {
    const r = await sendZaloText(userId, text);
    if (!r.ok) {
      console.error(
        `[zalo] send fail user=${userId}:`,
        r.error,
        r.outsideWindow ? "(ngoài 48h)" : ""
      );
    }
    return r;
  } catch (err) {
    console.error(`[zalo] send error user=${userId}:`, err.message);
    return { ok: false, error: err.message };
  }
}
