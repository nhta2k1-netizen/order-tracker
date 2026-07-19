/**
 * Command handlers cho Telegram bot.
 */
import {
  subscribe,
  listSubscriptionsByChat,
  unsubscribe,
  unsubscribeAll,
  replaceHistory,
} from "@order-tracker/db";
import {
  trackPackage,
  extractTrackingNumbers,
  extractFirstTrackingNumber,
  formatTrackingTelegram,
  helpText,
  escapeHtml,
  detectCarrier,
} from "@order-tracker/shared";

function userFromCtx(ctx) {
  const from = ctx.from || {};
  return {
    chatId: String(ctx.chat?.id || from.id),
    username: from.username || null,
    firstName: from.first_name || null,
    lastName: from.last_name || null,
  };
}

/**
 * /start [payload] — payload có thể là mã từ deep link t.me/bot?start=TRACK
 */
export async function handleStart(ctx) {
  const payload = (ctx.message?.text || "").split(/\s+/).slice(1).join(" ").trim();

  await ctx.reply(helpText(), {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });

  if (payload) {
    const code = extractFirstTrackingNumber(payload) || payload.toUpperCase();
    if (code && code.length >= 8) {
      await trackAndSubscribe(ctx, code);
    }
  }
}

export async function handleHelp(ctx) {
  await ctx.reply(helpText(), {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });
}

/**
 * /track <mã> hoặc /track <mã1> <mã2>
 */
export async function handleTrack(ctx) {
  const text = (ctx.message?.text || "").trim();
  const args = text.replace(/^\/track(@\w+)?/i, "").trim();

  if (!args) {
    await ctx.reply(
      "📦 Gửi mã vận đơn sau lệnh:\n<code>/track SPXVN0123456789</code>\n\nHoặc gửi thẳng mã / link đơn hàng.",
      { parse_mode: "HTML" }
    );
    return;
  }

  const codes = extractTrackingNumbers(args);
  if (codes.length === 0) {
    // fallback: cả phần args là 1 mã
    const raw = args.split(/\s+/)[0];
    if (raw.length >= 8) codes.push(raw.toUpperCase());
  }

  if (codes.length === 0) {
    await ctx.reply("❌ Không tìm thấy mã vận đơn hợp lệ.");
    return;
  }

  // Giới hạn 5 mã / lần
  const limited = codes.slice(0, 5);
  for (const code of limited) {
    await trackAndSubscribe(ctx, code);
  }
  if (codes.length > 5) {
    await ctx.reply(`⚠️ Chỉ xử lý 5 mã đầu (bạn gửi ${codes.length} mã).`);
  }
}

/**
 * /status <mã> — tra cứu không bắt buộc subscribe
 */
export async function handleStatus(ctx) {
  const text = (ctx.message?.text || "").trim();
  const args = text.replace(/^\/status(@\w+)?/i, "").trim();
  const code = extractFirstTrackingNumber(args) || args.split(/\s+/)[0];

  if (!code || code.length < 8) {
    await ctx.reply("Dùng: <code>/status SPXVN…</code>", {
      parse_mode: "HTML",
    });
    return;
  }

  const wait = await ctx.reply(`⏳ Đang tra cứu <code>${escapeHtml(code.toUpperCase())}</code>…`, {
    parse_mode: "HTML",
  });

  const result = await trackPackage(code);
  const msg = formatTrackingTelegram(result, { mode: "full" });

  try {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      wait.message_id,
      undefined,
      msg,
      { parse_mode: "HTML", link_preview_options: { is_disabled: true } }
    );
  } catch {
    await ctx.reply(msg, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
  }
}

/**
 * /list
 */
export async function handleList(ctx) {
  const { chatId } = userFromCtx(ctx);
  const rows = listSubscriptionsByChat(chatId);

  if (rows.length === 0) {
    await ctx.reply(
      "📭 Bạn chưa theo dõi mã nào.\nGửi <code>/track &lt;mã&gt;</code> để bắt đầu.",
      { parse_mode: "HTML" }
    );
    return;
  }

  const lines = [`📋 <b>Đang theo dõi (${rows.length})</b>`, ``];
  for (const row of rows) {
    const st = escapeHtml(row.current_status || "Chưa có TT");
    const carrier = escapeHtml(row.carrier_name || row.carrier || "?");
    lines.push(`📦 <code>${escapeHtml(row.tracking_number)}</code>`);
    lines.push(`   ${carrier} · <b>${st}</b>`);
    lines.push(``);
  }
  lines.push(`Dừng: <code>/untrack &lt;mã&gt;</code>`);

  await ctx.reply(lines.join("\n"), {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });
}

/**
 * /untrack <mã>
 */
export async function handleUntrack(ctx) {
  const text = (ctx.message?.text || "").trim();
  const args = text.replace(/^\/untrack(@\w+)?/i, "").trim();
  const code = extractFirstTrackingNumber(args) || args.split(/\s+/)[0];

  if (!code) {
    await ctx.reply("Dùng: <code>/untrack SPXVN…</code>", {
      parse_mode: "HTML",
    });
    return;
  }

  const { chatId } = userFromCtx(ctx);
  const res = unsubscribe(chatId, code.toUpperCase());

  if (!res.ok) {
    await ctx.reply(
      res.reason === "not_found"
        ? "❌ Không thấy mã này trong hệ thống."
        : "❌ Bạn không đang theo dõi mã này."
    );
    return;
  }

  await ctx.reply(
    `🛑 Đã dừng theo dõi <code>${escapeHtml(res.package.tracking_number)}</code>`,
    { parse_mode: "HTML" }
  );
}

/**
 * /untrack_all
 */
export async function handleUntrackAll(ctx) {
  const { chatId } = userFromCtx(ctx);
  const res = unsubscribeAll(chatId);
  await ctx.reply(`🛑 Đã dừng theo dõi <b>${res.count}</b> mã.`, {
    parse_mode: "HTML",
  });
}

/**
 * Tin nhắn thường: mã / link → track
 */
export async function handleText(ctx) {
  const text = (ctx.message?.text || "").trim();
  if (!text || text.startsWith("/")) return;

  const codes = extractTrackingNumbers(text);
  if (codes.length === 0) {
    await ctx.reply(
      "🤔 Không thấy mã vận đơn.\nGửi mã (vd. <code>SPXVN…</code>) hoặc /help",
      { parse_mode: "HTML" }
    );
    return;
  }

  for (const code of codes.slice(0, 5)) {
    await trackAndSubscribe(ctx, code);
  }
}

/**
 * Core: tra cứu live + lưu DB + đăng ký notify.
 * @param {import('telegraf').Context} ctx
 * @param {string} trackingNumber
 */
export async function trackAndSubscribe(ctx, trackingNumber) {
  const code = String(trackingNumber).trim().toUpperCase();
  const user = userFromCtx(ctx);
  const detected = detectCarrier(code);

  const wait = await ctx.reply(
    `⏳ Tra cứu <code>${escapeHtml(code)}</code> (${escapeHtml(detected.name)})…`,
    { parse_mode: "HTML" }
  );

  const result = await trackPackage(code);
  const latestMsg = result.events?.[0]?.message || result.currentStatus || null;

  // Vẫn cho subscribe kể cả khi tạm chưa có TT (poller sẽ thử lại)
  const { package: pkg } = subscribe({
    ...user,
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

  const body = formatTrackingTelegram(result, { mode: "full" });
  const footer = result.ok
    ? `\n\n🔔 Đã bật thông báo khi trạng thái đổi.\n📋 /list · 🛑 /untrack <code>${escapeHtml(code)}</code>`
    : `\n\n🔔 Vẫn đã đăng ký theo dõi — bot sẽ báo khi có dữ liệu.\n🛑 /untrack <code>${escapeHtml(code)}</code>`;

  const full = body + footer;

  try {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      wait.message_id,
      undefined,
      full,
      { parse_mode: "HTML", link_preview_options: { is_disabled: true } }
    );
  } catch {
    await ctx.reply(full, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
  }
}
