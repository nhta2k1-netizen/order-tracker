/**
 * Worker polling thông minh:
 * - fast: đang giao
 * - normal: đang vận chuyển
 * - slow: chờ lấy
 * - stop: đã giao / hoàn / hủy → tắt package
 */
import {
  listActivePackages,
  updatePackageFromTrack,
  replaceHistory,
  listActiveSubsForPackage,
  markSubscriptionNotified,
  deactivatePackage,
} from "@order-tracker/db";
import {
  trackPackage,
  pollPriority,
  isTerminalStatus,
  formatTrackingTelegram,
} from "@order-tracker/shared";

let timer = null;
let running = false;
let lastRunAt = null;
let lastSummary = null;

function envMinutes(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * @param {import('telegraf').Telegraf} bot
 */
export function startPoller(bot) {
  const baseMin = envMinutes("POLL_INTERVAL_MINUTES", 10);
  const ms = baseMin * 60 * 1000;

  if (timer) clearInterval(timer);

  // Lần đầu sau 8s
  setTimeout(() => {
    pollAll(bot).catch((e) => console.error("[poller] first", e));
  }, 8000);

  timer = setInterval(() => {
    pollAll(bot).catch((e) => console.error("[poller] tick", e));
  }, ms);

  console.log(`[poller] Chạy mỗi ${baseMin} phút (smart priority bên trong)`);
  return { intervalMinutes: baseMin };
}

/**
 * @param {import('telegraf').Telegraf} bot
 */
export async function pollAll(bot) {
  if (running) {
    return { skipped: true, reason: "busy" };
  }
  running = true;
  const started = Date.now();
  const results = [];

  try {
    const packages = listActivePackages();
    const now = Date.now();

    for (const pkg of packages) {
      // Smart skip theo priority + last_checked
      if (!shouldCheckNow(pkg, now)) {
        results.push({
          tracking: pkg.tracking_number,
          skipped: true,
          reason: "not_due",
        });
        continue;
      }

      try {
        const r = await checkAndNotify(bot, pkg);
        results.push(r);
        await sleep(500);
      } catch (err) {
        console.error(`[poller] ${pkg.tracking_number}`, err.message);
        results.push({
          tracking: pkg.tracking_number,
          ok: false,
          error: err.message,
        });
      }
    }
  } finally {
    running = false;
    lastRunAt = new Date().toISOString();
    lastSummary = {
      at: lastRunAt,
      durationMs: Date.now() - started,
      total: results.length,
      checked: results.filter((r) => !r.skipped).length,
      changed: results.filter((r) => r.statusChanged).length,
      notified: results.filter((r) => r.notified > 0).length,
      errors: results.filter((r) => r.ok === false).length,
    };
    console.log("[poller]", JSON.stringify(lastSummary));
  }

  return { skipped: false, results, summary: lastSummary };
}

/**
 * Có nên poll package này lúc này không (tần suất theo trạng thái).
 */
function shouldCheckNow(pkg, nowMs) {
  const last = pkg.last_checked_at
    ? new Date(pkg.last_checked_at + "Z").getTime()
    : 0;
  // SQLite datetime('now') là UTC không có Z — parse an toàn
  let lastMs = 0;
  if (pkg.last_checked_at) {
    const parsed = Date.parse(
      pkg.last_checked_at.includes("T")
        ? pkg.last_checked_at
        : pkg.last_checked_at.replace(" ", "T") + "Z"
    );
    lastMs = Number.isNaN(parsed) ? 0 : parsed;
  }

  const priority = pollPriority(pkg.current_status, pkg.current_status_raw);
  const fast = envMinutes("POLL_FAST_MINUTES", 5);
  const normal = envMinutes("POLL_INTERVAL_MINUTES", 10);
  const slow = envMinutes("POLL_SLOW_MINUTES", 30);

  let intervalMin = normal;
  if (priority === "fast") intervalMin = fast;
  else if (priority === "slow") intervalMin = slow;
  else if (priority === "stop") return false;

  if (!lastMs) return true;
  return nowMs - lastMs >= intervalMin * 60 * 1000;
}

/**
 * @param {import('telegraf').Telegraf} bot
 * @param {any} pkg
 */
async function checkAndNotify(bot, pkg) {
  const result = await trackPackage(pkg.tracking_number);
  if (!result.ok) {
    // vẫn cập nhật last_checked gián tiếp qua message lỗi nhẹ
    updatePackageFromTrack(pkg.id, {
      ...result,
      currentStatus: pkg.current_status,
      currentStatusRaw: pkg.current_status_raw,
      events: [],
    });
    return {
      tracking: pkg.tracking_number,
      ok: false,
      error: result.error,
      statusChanged: false,
      notified: 0,
    };
  }

  const prevStatus = pkg.current_status;
  const statusChanged = Boolean(prevStatus && prevStatus !== result.currentStatus);
  const isNewStatus = !prevStatus;

  updatePackageFromTrack(pkg.id, result);
  replaceHistory(pkg.id, result.events);

  let notified = 0;
  if (statusChanged || isNewStatus) {
    const subs = listActiveSubsForPackage(pkg.id);
    for (const sub of subs) {
      // Chỉ báo khi status khác last_notified
      if (
        sub.last_notified_status &&
        sub.last_notified_status === result.currentStatus
      ) {
        continue;
      }

      const text = formatTrackingTelegram(result, {
        mode: "update",
        prevStatus: sub.last_notified_status || prevStatus,
      });

      try {
        await bot.telegram.sendMessage(sub.chat_id, text, {
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        });
        markSubscriptionNotified(sub.chat_id, pkg.id, result.currentStatus);
        notified += 1;
      } catch (err) {
        console.error(
          `[poller] notify ${sub.chat_id} ${pkg.tracking_number}:`,
          err.message
        );
      }
      await sleep(200);
    }
  }

  if (isTerminalStatus(result.currentStatus, result.currentStatusRaw)) {
    deactivatePackage(pkg.id);
  }

  return {
    tracking: pkg.tracking_number,
    ok: true,
    status: result.currentStatus,
    statusChanged: statusChanged || isNewStatus,
    notified,
  };
}

export function getPollerStatus() {
  return {
    running,
    lastRunAt,
    lastSummary,
    intervalMinutes: envMinutes("POLL_INTERVAL_MINUTES", 10),
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
